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


