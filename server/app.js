const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const studentsList = require('./assets/students.js');
const quizList = require('./assets/quiz_questions.js');

  console.log({studentsList})
  console.log({quizList})

  // console.log()

// Path to proto file
const PROTO_PATHS = [
    path.join(__dirname, './proto/education.proto'),
    // path.join(__dirname, './proto/quiz_dispatcher.proto'),
    // path.join(__dirname, './proto/quiz_monitor.proto')
];

const packageDefinition = protoLoader.loadSync(PROTO_PATHS, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const educationProto = grpc.loadPackageDefinition(packageDefinition).education;

// Student Check-in Service
function SendAttenceConfirmation(call, callback) {

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
    } else {
        response = `Student with ID ${studentId} not found.`;
    }
      console.log({response})
  callback(null, { confirmationResponse: response });

}



// Quiz Dispatcher Service
// server stream get request to send quiz.
// check if quiz is active, if so send quiz content, if not send message that quiz is not active

function GetActiveQuiz(call) {
    const activeQuiz = quizList.quiz_list.find(q => q.status === 'active');
    if (!activeQuiz) {
        console.log(`[QUIZ] No active quiz available.`);
        call.write({
                id: 0,
                questionTitle: "There is no active quiz available.",
                questionOptions: [],
                questionAnswer: ""
        });

    } else {
        for (const question of activeQuiz.questions) {
          console.log(question.question_id, question.question, question.options, question.correct)
            call.write({
                id: question.question_id,
                questionTitle: question.question,
                questionOptions: question.options, // Pass the array directly!
                questionAnswer: question.correct
            });
        }
        console.log(`[QUIZ] Streamed ${activeQuiz.questions.length} questions.`);
    }

    call.end();
}
    //find the quiz in the list

// function DispatchQuiz(call) {
//   const quizId = call.request.quiz_id;
//   const quizContent = `Quiz content for quiz ID: ${quizId}`; // Simulated quiz content

//   // Simulate streaming quiz content in chunks

// Create server
const server = new grpc.Server();

server.addService(educationProto.AttendenceService.service, {
  SendAttenceConfirmation: SendAttenceConfirmation,
});

server.addService(educationProto.ServerStreamQuiz.service, {
    GetActiveQuiz: GetActiveQuiz,
});

// Start server
server.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Server Streaming gRPC server running on port 50053');
  }
);