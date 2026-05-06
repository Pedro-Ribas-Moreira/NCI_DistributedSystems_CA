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

    //   repeated StudentAttendanceInfo student_attendance_info = 1;
    call.write({student_attendance_info: studentsList, message: "Initial student attendance status."}); // Send initial attendance status to professor


    call.on('end', () => {
        console.log('Professor disconnected from live tracker.');
        professorAttendenceStream = null; // Clear the stream when professor disconnects
        call.end();
    });

    call.on('error', (err) => {
        console.error('Error in ProfessorAttendenceTracker stream:', err);
        professorAttendenceStream = null; // Clear the stream on error
    });

    console.log('Professor connected to live tracker.');

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

const ProfessorQuizActivation = (call, callback) => {
    const quizId = call.request.quiz_id;
    
    //find the quiz in the list
    const quiz = quizList.quiz_list.find(q => q.id === parseInt(quizId));
    if (quiz) {
        if(quiz.status === 'active') {
            callback(null, { message: `Quiz ${quiz.title} is already active.` });
        } else {
            quiz.status = 'active';
            callback(null, { message: `Quiz ${quiz.title} is now active.` });
        }
    } else {
        callback(null, { message: `Quiz with ID ${quizId} not found.` });
    }
}


// Student Check-in Service
const StudentAttendenceCheckIn = (call, callback) =>{

  const studentId = call.request.student_id;
  let response = "";

  //find the student in the list
    const student = studentsList.find(s => s.id === parseInt(studentId));
    if (student) {
        if(student.checkInStatus === 'true') {
            response = `You have already checked in.`;

        } else {
            student.checkInStatus = 'true';
            student.location = call.request.student_location; 
            response = `Cheked in successfully.`;   
            if(professorAttendenceStream) {
                professorAttendenceStream.write({ student_attendance_info: studentsList, message: `Student ${student.studentName} checked in from location ${student.location}.`});
            }
        }
    } else {
        response = `Student with ID ${studentId} not found.`;
    }
  console.log("Student Check-in Request:", call.request);
  callback(null, { confirmationResponse: response });

}

// client side streamning   rpc StudentTelemetry (stream StudentTelemetryRequest) returns (StudentTelemetryResponse);

const StudentTelemetry = (call, callback) => {
    call.on('data', (telemetryData) => {
        console.log('Received telemetry data from student:', telemetryData);
        // Here you can process the telemetry data as needed, e.g., store it in a database or analyze it.
    });

    call.on('end', () => {
        console.log('Student finished sending telemetry data.');
        callback(null, { message: 'Telemetry data received successfully.' });
    });
}
const StudentQuizRequest = (call, callback) => {
    const studentId = call.request.student_id;
    const quizId = call.request.quiz_id;

    console.log(`Received quiz request from student ${studentId} for quiz ${quizId}.`);
//       string student_id = 1;
//   string student_name = 2;
//   repeated string student_quiz_info = 3;
//   string message = 5;
    
    //find the quiz in the list
    const quiz = quizList.quiz_list.find(q => q.id === parseInt(quizId));
    if (quiz) {
        if(quiz.status === 'active') {
            const studentQuizInfo = quiz.questions.map(q => q.question);
            callback(null, {
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                quiz_questions: studentQuizInfo,
                message: `Quiz ${quiz.title} is active. Here are the questions.`
            });
        } else {
            callback(null, {
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                quiz_questions: [],
                message: `Quiz ${quiz.title} is not active yet. Please wait for the professor to activate it.`
            });
        }
    } else {
        callback(null, {
            quiz_id: parseInt(quizId),
            quiz_title: "N/A",
            quiz_questions: [],
            message: `Quiz with ID ${quizId} not found.`
        });
    }
}


// //   rpc StudentQuizSubmission (stream StudentQuizSubmissionRequest) returns (stream StudentQuizSubmissionResponse);

// message StudentQuizSubmissionRequest {
//   string student_id = 1;
//   int32 quiz_id = 2;
//   string submitted_answers = 3;
// } 

const StudentQuizSubmission = (call, callback) => {
    // 
    call.on('data', (submission) => {
        console.log('Received quiz submission from student:', submission);
        // Here you can process the quiz submission as needed, e.g., store it in a database or analyze it.
        const quiz = quizList.quiz_list.find(q => q.id === parseInt(submission.quiz_id));
        if (quiz) {
            const studentQuizInfo = quiz.questions.map(q => q.question);
            if(professorQuizStream) {
                professorQuizStream.write({
                    student_id: submission.student_id,
                    student_name: `Student ${submission.student_id}`,
                    student_quiz_info: studentQuizInfo,
                    message: `Student ${submission.student_id} submitted answers for quiz ${quiz.title}.`
                });
            }
        }   
    }
    );

    call.on('end', () => {
        console.log('Student finished submitting quiz answers.');
        callback(null, { message: 'Quiz submission received successfully.' });
    });

}





const server = new grpc.Server();

server.addService(educationProto.EducationService.service, {
    ProfessorAttendenceTracker: ProfessorAttendenceTracker,
    ProfessorQuizTracker: ProfessorQuizTracker,
    ProfessorQuizActivation: ProfessorQuizActivation,
    StudentQuizRequest: StudentQuizRequest,
    StudentAttendenceCheckIn: StudentAttendenceCheckIn,
    StudentQuizSubmission: StudentQuizSubmission,
    StudentTelemetry: StudentTelemetry
});

// Start server
server.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Server Streaming gRPC server running on port 50053');
  }
);