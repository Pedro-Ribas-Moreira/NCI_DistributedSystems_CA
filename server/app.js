const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const studentsList = require('./assets/students.js');
const quizList = require('./assets/quiz_questions.js');


//need to create two variables that will hold the student subission of quizes, and the student telemetry. while we ddon't have database, we can store this information in memory. these variables will be updated every time a student submits a quiz or sends telemetry data, and the professor will receive real-time updates through the streaming RPCs.
let studentQuizSubmissions = [];

let studentTelemetryData = [];

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


// format the roster
const formatMessageStudentInfo = (students) => {
    const formattedRoster = students.map(student => {
        return {
            id: student.id,
            student_name: student.studentName,
            check_in_status: student.checkInStatus,
            location: student.location
        }
    });
    console.log("Formatting roster for professor:", formattedRoster);
    return formattedRoster;
}
// Professor connection for monitoringattendance status
const ProfessorAttendenceTracker =  (call) => {
    professorAttendenceStream = call; // Store the stream for later use 

    //   repeated StudentAttendanceInfo student_attendance_info = 1;
    call.write({student_attendance_info: formatMessageStudentInfo(studentsList), message: "Initial student attendance status."}); // Send initial attendance status to professor


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
    console.log(`[SERVER] Professor connected to Quiz Monitor.`);
    
    if(!professorQuizStream){
        professorQuizStream = call; 
    }
     call.on('data', (data)=>{
        console.log('Server - Quiz Tracker')
        console.log(data)
        
            const quizId = call.quiz_id;
        
            // 1. Check if the quiz exists and activate it if needed
            const quiz = quizList.quiz_list.find(q => q.id === parseInt(quizId));
            if (quiz) {
                if (quiz.status !== 'active') {
                    quiz.status = 'active';
                    console.log(`[SERVER] Quiz "${quiz.title}" is now active.`);
                }
                
                // Push an initial confirmation message to the professor
                call.write({
                    quiz_id: quizId,
                    message: `Monitoring started for: ${quiz.title}. Status: ${quiz.status}`
                });
            }   
        
    })

    // 2. Clean up when professor disconnects
    call.on('end', () => {
        console.log('[SERVER] Professor disconnected from quiz tracker.');
        professorQuizStream = null;
        call.end();
    });

    call.on('error', (err) => {
        console.error('[SERVER] ProfessorQuizTracker Error:', err.message);
        professorQuizStream = null;
    });
};

const ProfessorQuizActivation = (call, callback) => {
    console.log("Professor requested quiz activation:" , call.request.quiz_id);
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
        if(student.checkInStatus === true) {
            response = `200 - You have already checked in.`;

        } else {
            student.checkInStatus = true;
            student.location = call.request.student_location; 
            response = `200 - Checked in successfully.`;   
            if(professorAttendenceStream) {

                console.log("Updated student attendance status:", formatMessageStudentInfo(studentsList));
            

                professorAttendenceStream.write({student_attendance_info: formatMessageStudentInfo(studentsList), message: "Student checked in: " + student.studentName});


            }
        }
    } else {
        response = `404 - Student with ID ${studentId} not found.`;
    }
  console.log("Student Check-in Request:", call.request);
  callback(null, { confirmation_response: response });

}

// client side streamning   rpc StudentTelemetry (stream StudentTelemetryRequest) returns (StudentTelemetryResponse);

const StudentTelemetry = (call, callback) => {
    let eventCount = 0;
    let studentId = "Unknown";

    // This fires every time the client sends a "ping"
    call.on('data', (data) => {
        eventCount++;
        studentId = data.student_id;
        console.log(`[TELEMETRY] Event #${eventCount} from ${studentId}: ${data.activity_type}`);
    });

    // This fires ONLY when the client calls stream.end()
    call.on('end', () => {
        console.log(`[TELEMETRY] Session ended for ${studentId}. Total: ${eventCount}`);
        
        // This is where you send the SINGLE summary response
        callback(null, {
            student_id: studentId,
            telemetry_status: "Complete",
            message: `Lecture engagement captured. Total events: ${eventCount}`
        });
    });
};


const StudentQuizRequest = (call, callback) => {
    const studentId = call.request.student_id;
    const quizId = call.request.quiz_id;

    console.log(`Received quiz request from student ${studentId} for quiz ${quizId}.`);
    const quiz = quizList.quiz_list.find(q => q.id === parseInt(quizId));
    if (quiz) {
        if(quiz.status === 'active') {
            const studentQuizInfo = quiz.questions.map(q => q.question);
            console.log(quiz.questions)
            callback(null, {
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                quiz_questions: quiz.questions,
                message: `Quiz ${quiz.title} is active. Here are the questions.`
            });
        } else {
            callback(null, {
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                quiz_questions: [],
                message: `Quiz ${quiz.title} is not active yet. Please wait for the professor to activate the quiz.`
            });
        }
    } else {
        callback(null, {
            quiz_id: quizId,
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

const StudentQuizSubmission = (call) => {
    console.log("Student started submitting quiz answers via stream.");

    call.on('data', (submission) => {
        try {
            console.log('Received quiz submission from:', submission.student_id);

            const quizId = parseInt(submission.quiz_id);
            const studentId = submission.student_id; // Keeping as string to match proto student_id
            const submittedAnswer = submission.submitted_answers; 
            
            // 1. Safety Check: Does the quiz even exist?
            const quiz = quizList.quiz_list.find(q => q.id === quizId);
            
            if (!quiz) {
                console.error(`[ERROR] Quiz ${quizId} not found.`);
                return call.write({
                    student_id: studentId,
                    quiz_id: quizId,
                    submission_status: "Error",
                    feedback: "Error: Quiz not found on server."
                });
            }

            // 2. Logic: Save/Update submission
            let record = studentQuizSubmissions.find(
                s => s.student_id === studentId && s.quiz_id === quizId
            );

            if (record) {
                // Avoid duplicate entries for the same question if student clicks twice
                const existingAnsIndex = record.submitted_answers.findIndex(a => a.question_id === submittedAnswer.question_id);
                if (existingAnsIndex !== -1) {
                    record.submitted_answers[existingAnsIndex] = submittedAnswer;
                } else {
                    record.submitted_answers.push(submittedAnswer);
                }
            } else {    
                record = {
                    student_id: studentId,
                    quiz_id: quizId,
                    submitted_answers: [submittedAnswer],
                    submission_status: "Partial"
                };
                studentQuizSubmissions.push(record);
            }

            // 3. Response to Student
            const count = record.submitted_answers.length;
            const isFinished = count >= quiz.num_of_questions;

            call.write({
                student_id: studentId,
                quiz_id: quizId,
                submission_status: isFinished ? "Completed" : "Partial",
                feedback: `Answer received. Progress: ${count}/${quiz.num_of_questions}`,
            });

            // ========================================================
            // 4. PUSH TO PROFESSOR (Real-Time Engagement)
            // ========================================================
            if (professorQuizStream) {
                console.log(`[PUSH] Updating Professor on progress for Student ${studentId}`);
                
                professorQuizStream.write({
                    student_id: studentId,
                    quiz_id: quizId,
                    submitted_answers: record.submitted_answers, // Sending the full array of their answers
                    message: `Student ${studentId} just answered Question ${submittedAnswer.question_id}`
                });
            }
            console.log("Current Student Quiz Submissions State:", studentQuizSubmissions);
        } catch (err) {
            console.error("Critical error in stream handler:", err);
        }
    });

    call.on('end', () => {
        console.log("Student finished stream.");
        call.end();
    });
};





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