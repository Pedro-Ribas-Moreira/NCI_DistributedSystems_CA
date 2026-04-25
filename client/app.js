const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to proto file
const PROTO_PATH = path.join(__dirname, './proto/server_stream.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const serverStreamProto = grpc.loadPackageDefinition(packageDefinition).serverstreamdemo;

// Create client
const client = new serverStreamProto.ServerStreamService(
  'localhost:50053',
  grpc.credentials.createInsecure()
);

// Make request to server
const call = client.GetBooksByCategory({ category: 'programming' });

// Receive multiple messages from server
call.on('data', (book) => {
  console.log('Received book:', book);
});

// Server finished sending all messages
call.on('end', () => {
  console.log('Server streaming completed');
});

call.on('error', (err) => {
  console.error('Error:', err.message);
});