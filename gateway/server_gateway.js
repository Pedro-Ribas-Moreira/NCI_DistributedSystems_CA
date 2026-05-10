/**
 * NOTE FOR CA REPORT:
 * This file implements the "Backend-For-Frontend" (BFF) / API Gateway pattern. 
 * Since web browsers lack native support for HTTP/2 trailing headers required by gRPC, 
 * this Express/Socket.io server acts as a bridge.
 * * ADVANCED FEATURES IMPLEMENTED:
 * 1. Microservices Architecture: Manages 3 separate gRPC service connections.
 * 2. Naming Service Discovery: Uses the Bonjour (mDNS) protocol to dynamically 
 * discover services on the network instead of hardcoding IP addresses.
 * 3. Robust Error Handling: Includes guards for service availability and 
 * graceful shutdown protocols.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { Bonjour } = require('bonjour-service');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const bonjour = new Bonjour();

app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. gRPC PROTO LOADING
// ==========================================
const loaderOptions = {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
};

// Load the 3 separate definitions [cite: 72]
const attendancePkg = protoLoader.loadSync(path.join(__dirname, './proto/attendance.proto'), loaderOptions);
const attendanceProto = grpc.loadPackageDefinition(attendancePkg).attendance;

const quizPkg = protoLoader.loadSync(path.join(__dirname, './proto/quiz.proto'), loaderOptions);
const quizProto = grpc.loadPackageDefinition(quizPkg).quiz;

const telemetryPkg = protoLoader.loadSync(path.join(__dirname, './proto/telemetry.proto'), loaderOptions);
const telemetryProto = grpc.loadPackageDefinition(telemetryPkg).telemetry;

// ==========================================
// 2. gRPC CLIENTS & NAMED DISCOVERY
// ==========================================
let attendanceClient, quizClient, telemetryClient;

const browser = bonjour.find({ type: 'grpc' });

browser.on('up', (service) => {
    // Discovery logic to map network services to our gRPC clients 
    const address = service.addresses[0] || '127.0.0.1';
    console.log(`[DISCOVERY] Found: ${service.name} at ${address}:${service.port}`);

    if (service.name === 'Education-Attendance-Service') {
        attendanceClient = new attendanceProto.AttendanceService(`${address}:${service.port}`, grpc.credentials.createInsecure());
    } 
    else if (service.name === 'Education-Quiz-Service') {
        quizClient = new quizProto.QuizService(`${address}:${service.port}`, grpc.credentials.createInsecure());
    } 
    else if (service.name === 'Education-Telemetry-Service') {
        telemetryClient = new telemetryProto.TelemetryService(`${address}:${service.port}`, grpc.credentials.createInsecure());
    }
});

// ==========================================
// 3. STATE TRACKING 
// ==========================================
const activeStreams = {
    telemetry: {}, 
    quiz: {},      
    monitor: {},   
    roster: {}     
};

// ==========================================
// 4. WEBSOCKET ROUTING LOGIC
// ==========================================
io.on('connection', (socket) => {
    const sid = socket.id;
    console.log(`[BRIDGE] Connected: ${sid}`);

    // --- SERVICE 1: ATTENDANCE ---
    socket.on('start_roster_stream', (data) => {
        if (!attendanceClient) return socket.emit('error', 'Attendance Service not ready.');
        
        const stream = attendanceClient.ProfessorAttendenceTracker({ professor_id: data.professor_id });
        stream.on('data', (res) => socket.emit('roster_update', res));
        stream.on('error', (err) => console.error('[BRIDGE] Attendance Error:', err.message));
        activeStreams.roster[sid] = stream;
    });

    socket.on('student_checkin', (data) => {
        if (!attendanceClient) return socket.emit('checkin_error', { message: 'Service not ready.' });


    // ADVANCE FEATURE - Add 5 seconds deadline for the request
      const deadline = new Date(Date.now() + 5000);

        attendanceClient.StudentAttendenceCheckIn(data, { deadline }, (err, res) => {
            if (err && err.code === grpc.status.DEADLINE_EXCEEDED) {
                return socket.emit('checkin_error', { message: 'The attendance service timed out.' });
            }
            err ? socket.emit('checkin_error', err) : socket.emit('checkin_success', res);
        });
    });

    // --- SERVICE 2: QUIZ ---
    socket.on('start_quiz_monitor_stream', (data) => {
        if (!quizClient) return socket.emit('quiz_monitor_error', { message: 'Quiz Service not ready.' });
        
        if (!activeStreams.monitor[sid]) {
            const stream = quizClient.ProfessorQuizTracker();
            
            stream.on('data', (response) => socket.emit('quiz_monitor_update', response));
            stream.on('error', (err) => {
                if (err.code !== 1) { // Ignore normal cancellations
                    console.error('[BRIDGE] Quiz Monitor Error:', err.message);
                    socket.emit('quiz_monitor_error', { message: err.message });
                }
                delete activeStreams.monitor[sid];
            });
            stream.on('end', () => delete activeStreams.monitor[sid]);

            activeStreams.monitor[sid] = stream;
        }

        activeStreams.monitor[sid].write(data);
    });

    socket.on('submit_quiz_answers', (data) => {
        if (!quizClient) return;
        if (!activeStreams.quiz[sid]) {
            const stream = quizClient.StudentQuizSubmission();
            stream.on('data', (res) => socket.emit('submit_quiz_answers_response', res));
            activeStreams.quiz[sid] = stream;
        }
        activeStreams.quiz[sid].write(data);
    });

    socket.on('activate_quiz', (data) => {
        if (!quizClient) return;
        quizClient.ProfessorQuizActivation(data, (err, res) => {
            err ? socket.emit('quiz_activation_error', err) : socket.emit('quiz_activation_success', res);
        });
    });

    socket.on('request_quiz_questions', (data) => {
        if (!quizClient) return;

        // ADVANCED FEATURE: Passing Metadata Key
        const meta = new grpc.Metadata();
        meta.add('authorization', 'secure-token-123');
        
        quizClient.StudentQuizRequest(data, meta, (err, res) => {
                err ? socket.emit('quiz_questions_error', err) : socket.emit('quiz_questions', res);
            });
    });

    // --- SERVICE 3: TELEMETRY ---
    socket.on('start_telemetry_session', () => {
        if (!telemetryClient) return;
        activeStreams.telemetry[sid] = telemetryClient.StudentTelemetry((err, response) => {
            if (err) return socket.emit('telemetry_error', err);
            socket.emit('telemetry_summary', response);
        });
    });

    socket.on('send_telemetry_ping', (data) => {
        if (activeStreams.telemetry[sid]) activeStreams.telemetry[sid].write(data);
    });

    socket.on('stop_telemetry_session', () => {
        if (activeStreams.telemetry[sid]) {
            activeStreams.telemetry[sid].end();
            delete activeStreams.telemetry[sid];
        }
    });

    // --- CENTRAL CLEANUP ---
    socket.on('disconnect', () => {
        console.log(`[BRIDGE] Disconnected: ${sid}. Cleaning up...`);
        Object.keys(activeStreams).forEach(type => {
            if (activeStreams[type][sid]) {
                try {
                    activeStreams[type][sid].cancel ? activeStreams[type][sid].cancel() : activeStreams[type][sid].end();
                } catch (e) {}
                delete activeStreams[type][sid];
            }
        });
    });
});

// ==========================================
// 5. GRACEFUL SHUTDOWN & ERRORS
// ==========================================
const gracefulShutdown = () => {
    console.log('\n[GATEWAY] Shutdown signal received. Closing bridge...');
    io.close(() => {
        server.close(() => {
            if (attendanceClient) attendanceClient.close();
            if (quizClient) quizClient.close();
            if (telemetryClient) telemetryClient.close();
            console.log('[GATEWAY] Bridge closed.');
            process.exit(0);
        });
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('unhandledRejection', (reason) => console.error('[FATAL] Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('[FATAL] Uncaught Exception:', err));

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`Server Gateway running on http://localhost:${PORT}`);
});