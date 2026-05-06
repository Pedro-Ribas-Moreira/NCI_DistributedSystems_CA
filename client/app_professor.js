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
// Initiate the stream
const call = client.ProfessorAttendenceTracker({ professor_id: 'prof_123' });

// Listen for real-time updates from the server
call.on('data', (response) => {
    // Clear the console to simulate a "refreshing" UI dashboard
    console.log('--- LIVE CLASS ROSTER ---');
    console.log(`Last Updated: ${new Date().toLocaleTimeString()}\n`);
    console.log(response);
});

call.on('error', (err) => {
    console.error('Dashboard Error:', err.message);
});


console.log('Requesting active quiz from server...');
const quizCall = client.ProfessorQuizTracker({ professor_id: 'prof_123', quiz_id: 1 });

quizCall.on('data', (response) => {
    console.log('--- ACTIVE QUIZ UPDATE ---');
    console.log(`Last Updated: ${new Date().toLocaleTimeString()}\n`);
    console.log(response);
});

quizCall.on('error', (err) => {
    console.error('Quiz Tracker Error:', err.message);
});

quizCall.on('end', () => {
    console.log('Quiz stream ended by server.');
});


// activate quiz

const requestMessage = {
  professor_id: 'prof_123' ,
  quiz_id: '1',
}; 

 
// Make request to server
client.ProfessorQuizActivation(requestMessage, (error, response) => {
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Received response:', response.message);
});


