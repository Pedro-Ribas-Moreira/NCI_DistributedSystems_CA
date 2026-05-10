const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const studentsList = require('./assets/students.js'); //
const { Bonjour } = require('bonjour-service');
const bonjour = new Bonjour();

const PROTO_PATH = path.join(__dirname, './proto/attendance.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const attendanceProto = grpc.loadPackageDefinition(packageDefinition).attendance;

let professorAttendenceStream = null;

const formatMessageStudentInfo = (students) => {
    return students.map(student => ({
        id: student.id.toString(),
        student_name: student.studentName,
        check_in_status: student.checkInStatus,
        location: student.location
    }));
}; //

const ProfessorAttendenceTracker = (call) => {
    professorAttendenceStream = call;
    call.write({
        student_attendance_info: formatMessageStudentInfo(studentsList),
        message: "Initial roster status."
    });
    call.on('end', () => { professorAttendenceStream = null; call.end(); });
    call.on('error', () => { professorAttendenceStream = null; });
}; //

const StudentAttendenceCheckIn = (call, callback) => {
    const studentId = parseInt(call.request.student_id);
    const student = studentsList.find(s => s.id === studentId);
    let response = "404 - Not Found";

    if (student) {
        student.checkInStatus = true;
        student.location = call.request.student_location;
        response = "200 - Checked in successfully.";
        if (professorAttendenceStream) {
            professorAttendenceStream.write({
                student_attendance_info: formatMessageStudentInfo(studentsList),
                message: `Student checked in: ${student.studentName}`
            });
        }
    }
    callback(null, { confirmation_response: response });
}; //

const server = new grpc.Server();
server.addService(attendanceProto.AttendanceService.service, {
    ProfessorAttendenceTracker: ProfessorAttendenceTracker,
    StudentAttendenceCheckIn: StudentAttendenceCheckIn,
});

server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    console.log('Attendance Service running on port 50051');
});

bonjour.publish({ 
    name: 'Education-Attendance-Service', 
    type: 'grpc', 
    port: 50051 
});