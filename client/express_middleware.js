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

// 3. WebSocket Connection Listener
io.on('connection', (socket) => {
    console.log(`[BRIDGE] Browser connected via WebSocket: ${socket.id}`);

    // ========================================================
    // HANDLING SERVER-SIDE STREAMING (Professor Live Roster)
    // ========================================================
    socket.on('start_roster_stream', (data) => {
        console.log(`[BRIDGE] Starting gRPC Roster Stream for ${data.professor_id}`);
        
        // Initiate the gRPC Server-Side Stream
        const call = grpcClient.ProfessorAttendenceTracker({ professor_id: data.professor_id });

        // Listen for data chunks coming from the gRPC server
        call.on('data', (response) => {
            // Instantly forward the data to the browser via WebSocket
            socket.emit('roster_update', response);
        });

        // Handle stream ending
        call.on('end', () => {
            socket.emit('roster_ended', { message: 'Server closed the stream.' });
        });

        call.on('error', (err) => {
            console.error('[BRIDGE] gRPC Stream Error:', err.message);
        });
        
        // If the professor closes their browser, stop the gRPC stream
        socket.on('disconnect', () => {
            console.log('[BRIDGE] Professor disconnected, cancelling gRPC stream.');
            call.cancel();
        });
    });

});

// Start the Bridge Server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n✅ Bridge Server running!`);
    console.log(`🌍 Open your browser and go to: http://localhost:${PORT}`);
});