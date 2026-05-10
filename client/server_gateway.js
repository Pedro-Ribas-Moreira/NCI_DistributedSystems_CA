/**
 * NOTE FOR CA REPORT:
 * I'm adding this file here because browsers and gRPC don't mix well directly. Native web browsers (like Chrome/Safari) can't connect directly to a gRPC server since they don't fully support HTTP/2 trailing headers and can't run Node.js libraries like '@grpc/grpc-js'.
 * Because of that "Two Worlds" issue, I built this Express server to act as a bridge (an "API Gateway" or "Backend-For-Frontend" pattern). It hosts the HTML frontend, catches standard WebSocket/HTTP requests from the browser, and translates them into those fast gRPC calls for the backend. Definitely need to highlight this architectural decision in the final report!
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

// Serve HTML files, find them on Public folder and render on the browser
app.use(express.static(path.join(__dirname, 'public')));

// 2. Set up the gRPC Client
const PROTO_PATH = path.join(__dirname, './proto/education.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const educationProto = grpc.loadPackageDefinition(packageDefinition).education;
const grpcClient = new educationProto.EducationService(
    'localhost:50053',
    grpc.credentials.createInsecure()
);

let activeTelemetryStreams = {};
const activeQuizStreams = {}; // To track active quiz submission streams per socket

// 3. WebSocket Connection Listener
io.on('connection', (socket) => {
    console.log(`[BRIDGE] Browser connected via WebSocket: ${socket.id}`);



        // ========================================================
    // LOGIC FOR: Professor Quiz Monitoring (Server-Side Stream)
    // ========================================================
    socket.on('start_quiz_monitor_stream', (data) => {
        console.log(`[GATEWAY] Professor ${data.professor_id} requesting monitor for Quiz ${data.quiz_id}`);

        // 1. Initiate the Server-Side gRPC Stream
        const call = grpcClient.ProfessorQuizTracker({
            professor_id: data.professor_id,
            quiz_id: data.quiz_id,
            student_id: data.student_id || "all" 
        });

        // 2. Listen for "chunks" of data from the gRPC Server
        call.on('data', (response) => {
            console.log(`[GATEWAY] Received gRPC update for Prof ${data.professor_id}:`, response.message);
            
            // 3. Forward the update to the browser immediately
            socket.emit('quiz_monitor_update', response);
        });

        // 4. Handle stream errors
        call.on('error', (err) => {
            console.error('[GATEWAY] gRPC Monitor Error:', err.message);
            socket.emit('quiz_monitor_error', { message: err.message });
        });

        // 5. Handle stream closure
        call.on('end', () => {
            console.log('[GATEWAY] gRPC Monitor Stream ended by server.');
            socket.emit('quiz_monitor_end');
        });

        // 6. If the browser disconnects, cancel the gRPC stream to save server resources
        socket.on('disconnect', () => {
            console.log(`[GATEWAY] Socket ${socket.id} disconnected, cancelling gRPC stream.`);
            if (call) call.cancel();
        });
    });


    // ========================================================
    // HANDLING SERVER-SIDE STREAMING ( Live Roster)
    // ========================================================
    socket.on('start_roster_stream', (data) => {
        console.log(`Professor - [BRIDGE] Starting gRPC Roster Stream for ${data.professor_id}`);
        
        // Initiate the gRPC Server-Side Stream
        const call = grpcClient.ProfessorAttendenceTracker({ professor_id: data.professor_id });

        // Listen for data chunks coming from the gRPC server
        call.on('data', (response) => {
            // Instantly forward the data to the browser via WebSocket
            console.log(`Professor - On ProfessorAttendenceTracker stream data received:`, response);
            socket.emit('roster_update', response);
        });

        // Handle stream ending
        call.on('end', () => {
            socket.emit('roster_ended', { message: 'Server closed the stream.' });
        });

        call.on('error', (err) => {
            console.error(' Professor - [BRIDGE] gRPC Stream Error:', err.message);
        });
        
        // If the professor closes their browser, stop the gRPC stream
        socket.on('disconnect', () => {
            console.log(' Professor - [BRIDGE] Professor disconnected, cancelling gRPC stream.');
            call.cancel();
        });

    });


    socket.on('activate_quiz', (data) => {
        console.log(`Professor - [BRIDGE] Received quiz activation request for quiz ${data.quiz_id} from professor ${data.professor_id}`);
        
        grpcClient.ProfessorQuizActivation(data, (error, response) => {
            if (error) {
                console.error(`Professor - [BRIDGE] Quiz activation error for professor ${data.professor_id}:`, error.message);
                return socket.emit('quiz_activation_error', { message: error.message });
            }
            console.log(`Professor - [BRIDGE] Quiz activation successful for professor ${data.professor_id}:`, response);
            socket.emit('quiz_activation_success', response);
        });
    });
// student check-in listener

        socket.on('student_checkin', (data) => {
            console.log(`Student - [BRIDGE] Received check-in from student: ${data.student_id}`);


            grpcClient.StudentAttendenceCheckIn(data, (error, response) => {
                if (error) {
                    console.error(`Student - [BRIDGE] Check-in error for student ${data.student_id}:`, error.message);
                    return socket.emit('checkin_error', { message: error.message });
                }
                console.log(`Student - [BRIDGE] Check-in successful for student ${data.student_id}:`, response);
                socket.emit('checkin_success', response);
            });
        });



socket.on('start_telemetry_session', (data) => {
    // Open the gRPC stream ONCE
    const grpcStream = grpcClient.StudentTelemetry((err, response) => {
        if (err) return socket.emit('telemetry_error', err);
        // Send the final summary back to the browser
        socket.emit('telemetry_summary', response);
    });
    activeTelemetryStreams[socket.id] = grpcStream;
});

socket.on('send_telemetry_ping', (data) => {
    const stream = activeTelemetryStreams[socket.id];
    if (stream) {
        stream.write(data); // Just write to the existing stream
    }
});

socket.on('stop_telemetry_session', () => {
    const stream = activeTelemetryStreams[socket.id];
    if (stream) {
        stream.end(); // Trigger the summary on the server
        delete activeTelemetryStreams[socket.id];
    }
});


        socket.on('request_quiz_questions', (data) => {
            console.log(`Student - [BRIDGE] Received quiz question request for quiz ${data.quiz_id} from student ${data.student_id}`);
            
            grpcClient.StudentQuizRequest(data, (error, response) => {
                if (error) {
                    console.error(`Student - [BRIDGE] Quiz question request error for student ${data.student_id}:`, error.message);
                    return socket.emit('quiz_questions_error', { message: error.message });
                }
                console.log(`Student - [BRIDGE] Quiz questions retrieved successfully for student ${data.student_id}:`, response);
                socket.emit('quiz_questions', response);
            });
        });



socket.on('submit_quiz_answers', (data) => {
    console.log(`Student - [BRIDGE] Submitting answer for Q:${data.submitted_answers.question_id}`);
    
    // 1. Create the stream if it doesn't exist for this socket
    if (!activeQuizStreams[socket.id]) {
        const call = grpcClient.StudentQuizSubmission();

        // Listen for data coming BACK from the Server stream
        call.on('data', (response) => {
            console.log("[BRIDGE] Server pushed submission update:", response);
            socket.emit('submit_quiz_answers_response', response);
        });

        call.on('error', (err) => {
            console.error("[BRIDGE] Submission Stream Error:", err);
            delete activeQuizStreams[socket.id];
        });

        activeQuizStreams[socket.id] = call;
    }

    // 2. Write the data to the gRPC stream
    activeQuizStreams[socket.id].write(data);
});



});



// Start the Bridge Server  
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Sever Gateway running!`);
    console.log(`Open your browser and go to: http://localhost:${PORT}`);
});