const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const studentsList = require('./assets/students.js');
const quizList = require('./assets/quiz_questions.js');

  console.log({studentsList})
  console.log({quizList})


// Path to proto file
const PROTO_PATHS = [
    path.join(__dirname, './proto/education.proto'),
    // path.join(__dirname, './proto/quiz_dispatcher.proto'),
    // path.join(__dirname, './proto/quiz_monitor.proto')
];

const packageDefinition = protoLoader.loadSync(PROTO_PATHS, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const educationProto = grpc.loadPackageDefinition(packageDefinition).education;

// Student Check-in Service
function SendAttenceConfirmation(call, callback) {

  const studentId = call.request.student_id;
  let response = "";

  //find the student in the list
    const student = studentsList.find(s => s.id === parseInt(studentId));
    if (student) {
        if(student.checkInStatus === 'true') {
            student.checkInStatus = 'false';
        } else {
            student.checkInStatus = 'true';
        }
        response = `Student ${student.studentName} has checked in with status: ${student.checkInStatus}`;
    } else {
        response = `Student with ID ${studentId} not found.`;
    }
      console.log({response})
  callback(null, { confirmationResponse: response });

}



// Quiz Dispatcher Service
// server streameer for quiz dispatching
// function DispatchQuiz(call) {
//   const quizId = call.request.quiz_id;
//   const quizContent = `Quiz content for quiz ID: ${quizId}`; // Simulated quiz content

//   // Simulate streaming quiz content in chunks

// Create server
const server = new grpc.Server();

server.addService(educationProto.AttendenceService.service, {
  SendAttenceConfirmation: SendAttenceConfirmation,
});

// Start server
server.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Server Streaming gRPC server running on port 50053');
  }
);