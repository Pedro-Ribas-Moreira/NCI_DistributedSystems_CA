/**
 * NOTE FOR CA REPORT:
 * Updated Gateway to support a Microservices Architecture. 
 * The bridge now manages three separate gRPC clients, each connecting to 
 * a specialized service (Attendance, Quiz, and Telemetry) on different ports.
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

app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. gRPC CLIENTS SETUP (Three separate services)
// ==========================================

const loaderOptions = {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
};

// --- Attendance Service (Port 50051) ---
const attendancePkg = protoLoader.loadSync(path.join(__dirname, './proto/attendance.proto'), loaderOptions);
const attendanceProto = grpc.loadPackageDefinition(attendancePkg).attendance;
const attendanceClient = new attendanceProto.AttendanceService('localhost:50051', grpc.credentials.createInsecure());

// --- Quiz Service (Port 50052) ---
const quizPkg = protoLoader.loadSync(path.join(__dirname, './proto/quiz.proto'), loaderOptions);
const quizProto = grpc.loadPackageDefinition(quizPkg).quiz;
const quizClient = new quizProto.QuizService('localhost:50052', grpc.credentials.createInsecure());

// --- Telemetry Service (Port 50053) ---
const telemetryPkg = protoLoader.loadSync(path.join(__dirname, './proto/telemetry.proto'), loaderOptions);
const telemetryProto = grpc.loadPackageDefinition(telemetryPkg).telemetry;
const telemetryClient = new telemetryProto.TelemetryService('localhost:50053', grpc.credentials.createInsecure());

// ==========================================
// 2. STATE TRACKING
// ==========================================
const activeStreams = {
    telemetry: {}, 
    quiz: {},      
    monitor: {},   
    roster: {}     
};

// ==========================================
// 3. WEBSOCKET ROUTING LOGIC
// ==========================================
io.on('connection', (socket) => {
    const sid = socket.id;
    console.log(`[BRIDGE] Connected: ${sid}`);

    // --- SERVICE 1: ATTENDANCE ---
    socket.on('start_roster_stream', (data) => {
        const stream = attendanceClient.ProfessorAttendenceTracker({ professor_id: data.professor_id });
        stream.on('data', (res) => socket.emit('roster_update', res));
        stream.on('error', (err) => console.error('[BRIDGE] Attendance Error:', err.message));
        activeStreams.roster[sid] = stream;
    });

    socket.on('student_checkin', (data) => {
        attendanceClient.StudentAttendenceCheckIn(data, (err, res) => {
            err ? socket.emit('checkin_error', err) : socket.emit('checkin_success', res);
        });
    });

    // --- SERVICE 2: QUIZ ---
    socket.on('start_quiz_monitor_stream', (data) => {
        if (!activeStreams.monitor[sid]) {
            const stream = quizClient.ProfessorQuizTracker();
            stream.on('data', (response) => socket.emit('quiz_monitor_update', response));
            stream.on('error', (err) => socket.emit('quiz_monitor_error', { message: err.message }));
            activeStreams.monitor[sid] = stream;
        }
        activeStreams.monitor[sid].write({
            professor_id: data.professor_id,
            quiz_id: data.quiz_id,
            message: data.message,
            type: data.type
        });
    });

    socket.on('submit_quiz_answers', (data) => {
        if (!activeStreams.quiz[sid]) {
            const stream = quizClient.StudentQuizSubmission();
            stream.on('data', (res) => socket.emit('submit_quiz_answers_response', res));
            activeStreams.quiz[sid] = stream;
        }
        activeStreams.quiz[sid].write(data);
    });

    socket.on('activate_quiz', (data) => {
        quizClient.ProfessorQuizActivation(data, (err, res) => {
            err ? socket.emit('quiz_activation_error', err) : socket.emit('quiz_activation_success', res);
        });
    });

    socket.on('request_quiz_questions', (data) => {
        quizClient.StudentQuizRequest(data, (err, res) => {
            err ? socket.emit('quiz_questions_error', err) : socket.emit('quiz_questions', res);
        });
    });

    // --- SERVICE 3: TELEMETRY ---
    socket.on('start_telemetry_session', () => {
        activeStreams.telemetry[sid] = telemetryClient.StudentTelemetry((err, response) => {
            if (err) return socket.emit('telemetry_error', err);
            socket.emit('telemetry_summary', response);
        });
    });

    socket.on('send_telemetry_ping', (data) => {
        if (activeStreams.telemetry[sid]) activeStreams.telemetry[sid].write(data);
    });

    // --- CLEANUP ---
    socket.on('disconnect', () => {
        console.log(`[BRIDGE] Disconnected: ${sid}. Cleaning up streams...`);
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
// 4. GRACEFUL SHUTDOWN
// ==========================================
const gracefulShutdown = () => {
    console.log('\n[GATEWAY] Closing bridge gracefully...');
    io.close(() => {
        server.close(() => {
            attendanceClient.close();
            quizClient.close();
            telemetryClient.close();
            process.exit(0);
        });
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`Server Gateway running on http://localhost:${PORT}`);
});