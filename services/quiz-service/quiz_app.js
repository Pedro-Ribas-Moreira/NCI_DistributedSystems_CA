const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const quizList = require('./assets/quiz_questions.js'); //
const { Bonjour } = require('bonjour-service');
const bonjour = new Bonjour();

const PROTO_PATH = path.join(__dirname, './proto/quiz.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const quizProto = grpc.loadPackageDefinition(packageDefinition).quiz;

let studentQuizSubmissions = [];
let monitorStreams = [];

const ProfessorQuizTracker = (call) => {
    monitorStreams.push(call);
    call.on('data', (data) => {
        if (data.type === 'InitialRequest') {
            const quiz = quizList.quiz_list.find(q => q.id === parseInt(data.quiz_id));
            if (quiz) {
                quiz.status = 'active';
                monitorStreams.forEach(s => s.write({ message: `Monitoring: ${quiz.title}`, type: 'StartMonitor' }));
            }
        } else if (data.type === 'Feedback') {
            monitorStreams.forEach(s => s.write({ message: data.message, type: 'Feedback' }));
        }
    });
    call.on('end', () => { monitorStreams = monitorStreams.filter(s => s !== call); });
    call.on('error', () => { monitorStreams = monitorStreams.filter(s => s !== call); });
}; //


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
const StudentQuizRequest = (call, callback) => {
    // ADVANCED FEATURE
    const token = call.metadata.get('authorization')[0];
    if (token !== 'secure-token-123') {
            return callback({
                code: grpc.status.UNAUTHENTICATED,
                message: "Invalid API Token"   
            });
        }

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
                // REMOTE ERROR HANDLING
                return call.emit('error', {
                    code: grpc.status.NOT_FOUND,
                    details: `Service Error: Quiz ID ${quizId} is not hosted on this microservice.`
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
            if (monitorStreams.length > 0) {
                console.log(`[PUSH] Updating Professor on progress for Student ${studentId}`);
                monitorStreams.forEach(stream => {
                stream.write({
                    student_id: studentId,
                    quiz_id: quizId,
                    submitted_answers: record.submitted_answers, // Sending the full array of their answers
                    message: `Student ${studentId} just answered Question ${submittedAnswer.question_id}`,
                    type: 'AnswerSubmission'
                });
            })
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
server.addService(quizProto.QuizService.service, {
    ProfessorQuizTracker: ProfessorQuizTracker,
    ProfessorQuizActivation: ProfessorQuizActivation,
    StudentQuizRequest: StudentQuizRequest,
    StudentQuizSubmission: StudentQuizSubmission
});

server.bindAsync('0.0.0.0:50052', grpc.ServerCredentials.createInsecure(), () => {
    console.log('Quiz Service running on port 50052');
});

bonjour.publish({ 
    name: 'Education-Quiz-Service', 
    type: 'grpc', 
    port: 50052 
});


const gracefulShutdown = () => {
    console.log('\n[QUIZ-SERVICE] Shutdown signal received. Cleaning up...');

    // Notify all active streams before closing
    monitorStreams.forEach(stream => {
        try { 
            stream.write({ message: "Quiz Server is shutting down...", type: "Shutdown" });
            stream.end(); 
        } catch (e) {}
    });

    server.tryShutdown((err) => {
        if (err) {
            console.error('[QUIZ-SERVICE] Shutdown error:', err);
            server.forceShutdown();
        }
        console.log('[QUIZ-SERVICE] Stopped.');
        process.exit(0);
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);