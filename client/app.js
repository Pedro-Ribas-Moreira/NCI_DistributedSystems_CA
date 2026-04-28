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
// const client = new educationProto.AttendenceService(
//   'localhost:50053',
//   grpc.credentials.createInsecure()

// );

// const requestMessage = {
//   student_id: '1' 
// };  
// // Make request to server
// client.SendAttenceConfirmation(requestMessage, (error, response) => {
//   if (error) {
//     console.error('Error:', error.message);
//     return;
//   }
  
//   console.log('Received response:', response.confirmationResponse);
// });



const client_serverStreamQuiz = new educationProto.ServerStreamQuiz(
    'localhost:50053',
    grpc.credentials.createInsecure()
);

console.log('Requesting questions from server...');
const call = client_serverStreamQuiz.GetActiveQuiz({ quizRequest: 'requesting_quiz' });

call.on('data', (response) => {
    // If there is no active quiz, the server sends question_id: 0
    if (response.question_id === 0) {
        console.log(`[SERVER MESSAGE]: ${response.question}`);
        return;
    }

    console.log({response});
    
});

// 5. Handle stream completion
call.on('end', () => {
    console.log('[CLIENT] Stream closed. All questions received.');
});

// 6. Handle errors
call.on('error', (err) => {
    console.error('[ERROR]', err.message);
});