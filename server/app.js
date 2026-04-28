const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const studentsList = require('./assets/students.js');

  console.log({studentsList})

// Path to proto file
const PROTO_PATHS = [
    path.join(__dirname, './proto/attendence.proto'),
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
const attendenceProto = grpc.loadPackageDefinition(packageDefinition).attendence;

    

// Server streaming method
// Client sends one request, server writes many responses
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
// Create server
const server = new grpc.Server();

server.addService(attendenceProto.AttendenceService.service, {
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