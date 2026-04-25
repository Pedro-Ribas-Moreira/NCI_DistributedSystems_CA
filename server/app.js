const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to proto file
const PROTO_PATH = path.join(__dirname, './proto/service.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const serviceProto = grpc.loadPackageDefinition(packageDefinition).service;

// Create server
const server = new grpc.Server();

// Start server
server.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Server Streaming gRPC server running on port 50053');
  }
);