const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const studentsList = require('./assets/students.js');
const quizList = require('./assets/quiz_questions.js');


console.log({studentsList})
console.log({quizList})

// create professorStream variable to hold the professor's stream for monitoring quiz and attendance status.
let professorAttendenceStream = null;
let professorQuizStream = null;
// Path to proto file
const PROTO_PATHS = [
    path.join(__dirname, './proto/education.proto'),
];

const packageDefinition = protoLoader.loadSync(PROTO_PATHS, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const educationProto = grpc.loadPackageDefinition(packageDefinition).education;

// Professor connection for monitoringattendance status
const ProfessorAttendenceTracker =  (call) => {
    professorAttendenceStream = call; // Store the stream for later use 

    call.write({ 
        student_id: "N/A",
        student_name: "N/A",
        student_location: "N/A",
        student_attendance_status: "N/A",
        message: 'Welcome Professor! You are now connected to the live tracker.'

     });


    call.on('end', () => {
        console.log('Professor disconnected from live tracker.');
        professorStream = null; // Clear the stream when professor disconnects
        call.end();
    });

    call.on('error', (err) => {
        console.error('Error in ProfessorAttendenceTracker stream:', err);
        professorStream = null; // Clear the stream on error
    });

    console.log('Professor connected to live tracker.');

}


// Student Check-in Service
const SendAttenceConfirmation = (call, callback) =>{

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
        if(professorStream) {
          professorStream.write({ // Send real-time update to professor
                studentId: student.id,  
                studentName: student.studentName,
                studentLocation: student.location,
                studentAttendanceStatus: student.checkInStatus,
                message: `Student ${student.studentName} has checked in with status: ${student.checkInStatus}`
          });
        }
    } else {
        response = `Student with ID ${studentId} not found.`;
    }
      console.log({response})
  callback(null, { confirmationResponse: response });

}

const ProfessorQuizTracker = (call) => { 
    //Professor request quiz to be active, and the server will send real-time updates on quiz status and student submissions.
    professorQuizStream = call; // Store the stream for later use
    const professorId = call.request.professor_id;

    console.log(`Professor ${professorId} connected to quiz tracker.`);
    const quizId = call.request.quiz_id;

    //find the quiz in the list
    // check if quiz is active, if is not, then activate, otherwise say quiz is already active. then send real-time updates on quiz status and student submissions.
    const quiz = quizList.quiz_list.find(q => q.id === parseInt(quizId));
    if (quiz) {
        if(quiz.status === 'active') {
            call.write({
                student_id: "N/A",
                student_name: "N/A",
                quiz_status: 'Active',
                message: `Quiz ${quiz.title} is already active.`    
            });
        } else {
            quiz.status = 'active';
            call.write({

                student_id: "N/A",
                student_name: "N/A",
                quiz_status: 'Active',
                message: `Quiz ${quiz.title} is now active.`
            });
        }
    }   
    
    call.on('end', () => {
        console.log('Professor disconnected from quiz tracker.');
        professorQuizStream = null; // Clear the stream when professor disconnects
        call.end();
    }
    );

    call.on('error', (err) => {
        console.error('Error in ProfessorQuizTracker stream:', err);
        professorQuizStream = null; // Clear the stream on error
    });


}

const server = new grpc.Server();

server.addService(educationProto.EducationService.service, {
  SendAttenceConfirmation: SendAttenceConfirmation,
  ProfessorAttendenceTracker: ProfessorAttendenceTracker,
  ProfessorQuizTracker: ProfessorQuizTracker
});

// Start server
server.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Server Streaming gRPC server running on port 50053');
  }
);