/**
 * NOTE FOR CA REPORT:
 * This file implements the "Backend-For-Frontend" (BFF) / API Gateway pattern. 
 * Since web browsers lack native support for HTTP/2 trailing headers required by gRPC, 
 * this Express/Socket.io server acts as a bridge, translating browser WebSockets 
 * into high-performance gRPC calls for the Education microservice.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);


// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));

// --- gRPC Client Setup ---
const PROTO_PATH = path.join(__dirname, './proto/education.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const educationProto = grpc.loadPackageDefinition(packageDefinition).education;
const grpcClient = new educationProto.EducationService(
    'localhost:50053',
    grpc.credentials.createInsecure()
);



// --- Stream Tracking ---
const activeStreams = {
    telemetry: {}, // Student Telemetry
    quiz: {},      // Student Submission
    monitor: {},   // Professor Monitoring
    roster: {}     // Professor Roster
};

// --- WebSocket Logic ---
io.on('connection', (socket) => {
    const sid = socket.id;
    console.log(`[BRIDGE] Connected: ${sid}`);

    // 1. PROFESSOR: Quiz Monitoring (Bidirectional)
    socket.on('start_quiz_monitor_stream', (data) => {
        if (!activeStreams.monitor[sid]) {
            const stream = grpcClient.ProfessorQuizTracker();

            stream.on('data', (response) => socket.emit('quiz_monitor_update', response));
            stream.on('error', (err) => socket.emit('quiz_monitor_error', { message: err.message }));
            stream.on('end', () => socket.emit('quiz_monitor_end'));

            activeStreams.monitor[sid] = stream;
        }

        activeStreams.monitor[sid].write({
            professor_id: data.professor_id,
            student_id: data.student_id,
            quiz_id: data.quiz_id,
            message: data.message
        });
    });

    // 2. PROFESSOR: Live Roster (Server-Side Stream)
    socket.on('start_roster_stream', (data) => {
        const stream = grpcClient.ProfessorAttendenceTracker({ professor_id: data.professor_id });

        stream.on('data', (res) => socket.emit('roster_update', res));
        stream.on('end', () => socket.emit('roster_ended'));
        stream.on('error', (err) => console.error('[BRIDGE] Roster Error:', err.message));

        activeStreams.roster[sid] = stream;
    });

    // 3. STUDENT: Telemetry (Client-Side Stream)
    socket.on('start_telemetry_session', () => {
        activeStreams.telemetry[sid] = grpcClient.StudentTelemetry((err, response) => {
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

    // 4. STUDENT: Quiz Submission (Bidirectional)
    socket.on('submit_quiz_answers', (data) => {
        if (!activeStreams.quiz[sid]) {
            const stream = grpcClient.StudentQuizSubmission();
            stream.on('data', (res) => socket.emit('submit_quiz_answers_response', res));
            activeStreams.quiz[sid] = stream;
        }
        activeStreams.quiz[sid].write(data);
    });

    // 5. STANDARD RPCs (Unary)
    socket.on('activate_quiz', (data) => {
        grpcClient.ProfessorQuizActivation(data, (err, res) => {
            err ? socket.emit('quiz_activation_error', err) : socket.emit('quiz_activation_success', res);
        });
    });

    socket.on('student_checkin', (data) => {
        grpcClient.StudentAttendenceCheckIn(data, (err, res) => {
            err ? socket.emit('checkin_error', err) : socket.emit('checkin_success', res);
        });
    });

    socket.on('request_quiz_questions', (data) => {
        grpcClient.StudentQuizRequest(data, (err, res) => {
            err ? socket.emit('quiz_questions_error', err) : socket.emit('quiz_questions', res);
        });
    });

    // --- CENTRAL CLEANUP ---
    socket.on('disconnect', () => {
        console.log(`[BRIDGE] Disconnected: ${sid}. Cleaning up streams...`);
        
        // Cancel/End all active gRPC streams for this socket
        Object.keys(activeStreams).forEach(type => {
            if (activeStreams[type][sid]) {
                // If it's a client-stream we .end(), if it's server-stream we .cancel()
                try {
                    activeStreams[type][sid].cancel ? activeStreams[type][sid].cancel() : activeStreams[type][sid].end();
                } catch (e) {
                    // Silently catch already-closed streams
                }
                delete activeStreams[type][sid];
            }
        });
    });
});


const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Server Gateway running on http://localhost:${PORT}`);
});