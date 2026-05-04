  const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to proto file
const PROTO_PATH = path.join(__dirname, './proto/education.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const educationProto = grpc.loadPackageDefinition(packageDefinition).education;
// Create client
const client = new educationProto.EducationService(
  'localhost:50053',
  grpc.credentials.createInsecure()

);



console.log('--- LIVE PROFESSOR DASHBOARD ---');
console.log('Waiting for students to check in...\n');

// Initiate the stream
const call = client.ProfessorAttendenceTracker({ professor_id: 'prof_123' });

// Listen for real-time updates from the server
call.on('data', (response) => {
    // Clear the console to simulate a "refreshing" UI dashboard
    console.clear(); 
    console.log('--- LIVE CLASS ROSTER ---');
    console.log(`Last Updated: ${new Date().toLocaleTimeString()}\n`);

    // Loop through the roster and display who is online/offline
    // response.student_roster.forEach(student => {
    //     const statusIcon = student.is_checked_in ? '🟢 ONLINE' : '🔴 OFFLINE';
    //     console.log(`[${statusIcon}] ${student.student_name} (ID: ${student.student_id})`);
    // });
    console.log(response);
});

call.on('error', (err) => {
    console.error('Dashboard Error:', err.message);
});

