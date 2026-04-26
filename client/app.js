const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to proto file
const PROTO_PATH = path.join(__dirname, './proto/attendence.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const attendenceProto = grpc.loadPackageDefinition(packageDefinition).attendence;

// Create client
const client = new attendenceProto.AttendenceService(
  'localhost:50053',
  grpc.credentials.createInsecure()

);

const requestMessage = {
  student_id: '1' 
};  
// Make request to server
client.SendAttenceConfirmation(requestMessage, (error, response) => {
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Received response:', response.confirmationResponse);
});

