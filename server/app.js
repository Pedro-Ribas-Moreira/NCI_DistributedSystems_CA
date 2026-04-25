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


// Sample book data
const books = [
  { id: 1, title: 'Node Basics', category: 'programming' },
  { id: 2, title: 'Advanced Node', category: 'programming' },
  { id: 3, title: 'History of Europe', category: 'history' },
  { id: 4, title: 'JavaScript Guide', category: 'programming' },
  { id: 5, title: 'World War II', category: 'history' },
];

// Server streaming method
// Client sends one request, server writes many responses
function getBooksByCategory(call) {
  const requestedCategory = call.request.category.toLowerCase();

  const filteredBooks = books.filter(
    (book) => book.category.toLowerCase() === requestedCategory
  );

  // Send each matching record one by one
  filteredBooks.forEach((book) => {
    call.write(book);
  });

  // End the stream after all data is sent
  call.end();
}
// Create server
const server = new grpc.Server();

server.addService(serverStreamProto.ServerStreamService.service, {
  GetBooksByCategory: getBooksByCategory,
});

// Start server
server.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Server Streaming gRPC server running on port 50053');
  }
);