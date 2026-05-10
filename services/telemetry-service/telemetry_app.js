const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, './proto/telemetry.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const telemetryProto = grpc.loadPackageDefinition(packageDefinition).telemetry;

const StudentTelemetry = (call, callback) => {
    let eventCount = 0;
    let studentId = "Unknown";
    call.on('data', (data) => {
        eventCount++;
        studentId = data.student_id;
    });
    call.on('end', () => {
        callback(null, {
            student_id: studentId,
            telemetry_status: "Complete",
            message: `Captured ${eventCount} engagement events.`
        });
    });
}; //

const server = new grpc.Server();
server.addService(telemetryProto.TelemetryService.service, { StudentTelemetry });

server.bindAsync('0.0.0.0:50053', grpc.ServerCredentials.createInsecure(), () => {
    console.log('Telemetry Service running on port 50053');
});