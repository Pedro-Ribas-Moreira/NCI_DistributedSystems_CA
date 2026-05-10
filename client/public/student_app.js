const socket = io();

// 2. Get Student Info from Session Storage
const studentId = sessionStorage.getItem('currentUserId');
const studentName = sessionStorage.getItem('currentUserName') || 'Student';

// DOM Elements
const startQuizBtn = document.getElementById('start-quiz-btn');
const quizContainer = document.getElementById('quiz-container');
const quizDetailsModal = document.getElementById('quiz-details-modal')
const quizAnswersContainer = document.getElementById('quiz-answers-container')

let activeQuiz;

console.log(`Student ID: ${studentId} --- DASHBOARD LOADED`);

// ========================================================
// 1. ATTENDANCE CHECK-IN ON LOAD
// ========================================================

function AttendanceCheckIn() {
    console.log(`${studentId}: Sending check-in request...`);
    const checkInData = {
        student_id: studentId,
        student_location: "Dublin, IE (Remote)" 
    };
    socket.emit('student_checkin', checkInData);
}

socket.on('checkin_success', (response) => {
    console.log(`${studentId}: Check-in confirmed:`, response);
});

socket.on('checkin_error', (data) => {
    console.error(`${studentId}: Check-in failed:`, data.message);
});

// ========================================================
// 2. REAL-TIME ACTIVITY TELEMETRY
// ======================================================== 



let lastActivityTime = Date.now();
let lastEventName = "page_load"; 
let telemetryInterval = null;

const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart', 'focus', 'visibilitychange'];

activityEvents.forEach(event => {
    window.addEventListener(event, () => {
        lastActivityTime = Date.now();
        lastEventName = event;
    });
});

// Function to start the session properly
function startTelemetrySession() {
    console.log("[TELEMETRY] Starting new engagement session...");
    socket.emit('start_telemetry_session', { student_id: studentId });
    
    // Initial ping
    socket.emit('send_telemetry_ping', { 
        student_id: studentId, 
        activity_type: 'session_start', 
        activity_timestamp: new Date().toISOString() 
    });

    // Check for activity every 20 seconds
    telemetryInterval = setInterval(() => {
        // Only send if the socket is actually connected to avoid "thousands of messages" error
        if (!socket.connected) return;

        const now = Date.now();
        const inactivityDuration = now - lastActivityTime;
        const isInactive = inactivityDuration > (5 * 60 * 1000); // 5 minutes
        
        let telemetryData = {
            student_id: studentId,
            activity_type: isInactive ? "inactive" : lastEventName,
            activity_timestamp: new Date().toISOString()
        };

        console.log(`Student - [TELEMETRY] Streaming status: ${telemetryData.activity_type}`);
        socket.emit('send_telemetry_ping', telemetryData);
    }, 20 * 1000);
}

// Function to end the session and get the summary
function stopTelemetrySession() {
    console.log("Student - [TELEMETRY] Closing session to request summary...");
    if (telemetryInterval) clearInterval(telemetryInterval);
    socket.emit('stop_telemetry_session');
}

// Listen for the final summary from the server
socket.on('telemetry_summary', (data) => {
    console.log(`\n--- LECTURE SUMMARY ---`);
    console.log(data.message);
    // You could show this in a small toast notification or UI element
});

// ========================================================
// 3. QUIZ SYSTEM
// ========================================================


const quizCorrectAnswers = [];
const studentQuizAnswers = [];
if (startQuizBtn) {
    startQuizBtn.addEventListener('click', () => {
        console.log("Student - Requesting quiz questions...");
        quizContainer.classList.remove('hidden');
        startQuizBtn.disabled = true;
        startQuizBtn.style.display = 'none';
        socket.emit('request_quiz_questions', { quiz_id: 1, student_id: studentId });
    });
}

socket.on('quiz_questions', (data) => {
    console.log("Received quiz questions:", data);

    // store the correct answers to display at end of the quiz
    data.quiz_questions.forEach(q => {
        quizCorrectAnswers.push({
            question_id: q.question_id,
            question_title: q.question,
            correct_option_id: q.correct ? q.correct.option_id : null, 
            correct_option_title: q.correct ? q.correct.option_title : null
        });
    }); 
        console.log(quizCorrectAnswers)
    quizContainer.innerHTML = `<h2 class="text-xl font-bold mb-4 text-blue-600">${data.quiz_title}</h2>`;
    
    const totalQuestions = data.quiz_questions.length;

    data.quiz_questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        // Hide all questions except the first one
        questionDiv.className = `quiz-question-block ${index === 0 ? '' : 'hidden'} mb-6 p-4 border rounded-xl bg-white shadow-sm`;
        
        questionDiv.innerHTML = `
            <p class="mb-4 font-bold text-slate-800 text-lg">${index + 1}. ${q.question}</p>
            <div class="options-list space-y-2">
                ${q.options.map(opt => `
                    <button class="option-btn w-full text-left px-4 py-3 border rounded-lg hover:bg-slate-50 transition cursor-pointer flex justify-between items-center group" data-option="${opt.option_id}">
                        <span>${opt.option_title}</span>
                        <div class="w-4 h-4 rounded-full border-2 border-slate-200 group-hover:border-blue-400 transition-colors"></div>
                    </button>
                `).join('')}
            </div>
        `;

        let selectedOptionId = null;
        const optionButtons = questionDiv.querySelectorAll('.option-btn');

        optionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Style cleanup
                optionButtons.forEach(b => {
                    b.classList.remove('bg-blue-50', 'border-blue-500', 'ring-2', 'ring-blue-200');
                    b.querySelector('div').classList.replace('bg-blue-500', 'bg-transparent');
                    b.querySelector('div').classList.add('border-slate-200');
                });
                
                // Select current
                const currentBtn = e.currentTarget;
                currentBtn.classList.add('bg-blue-50', 'border-blue-500', 'ring-2', 'ring-blue-200');
                currentBtn.querySelector('div').classList.replace('bg-transparent', 'bg-blue-500');
                currentBtn.querySelector('div').classList.remove('border-slate-200');
                currentBtn.querySelector('div').classList.add('border-blue-500');
                currentBtn.querySelector('div').classList.add('bg-blue-500');
                
                selectedOptionId = currentBtn.getAttribute('data-option');
            });
        });

        // Add the Action Button (Next or Submit)
        const actionBtn = document.createElement('button');
        const isLast = index === totalQuestions - 1;
        actionBtn.textContent = isLast ? "Submit Final Answer" : "Confirm & Next Question";
        actionBtn.className = `w-full mt-6 ${isLast ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold py-3 px-4 rounded-xl transition shadow-lg`;

        actionBtn.addEventListener('click', () => {
            if (!selectedOptionId) {
                alert("Please select an answer first!");
                return;
            }

          //  save answer to display results
            studentQuizAnswers.push({
                question_id: q.question_id,
                selected_option_id: parseInt(selectedOptionId)
            });
            // Emit the answer
            socket.emit('submit_quiz_answers', { 
                student_id: studentId, 
                quiz_id: data.quiz_id, 
                submitted_answers: {
                    question_id: parseInt(q.question_id),
                    selected_option_id: parseInt(selectedOptionId)
                } 
            });

            // Transition to next or show completion
            questionDiv.classList.add('hidden');
            const nextDiv = questionDiv.nextElementSibling;
            
            if (nextDiv && nextDiv.classList.contains('quiz-question-block')) {
                nextDiv.classList.remove('hidden');
            } else {
                quizContainer.innerHTML = `
                    <div class="text-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h3 class="text-xl font-bold text-slate-800">Quiz Completed!</h3>   
                    </div>
                `;

                // create new element div
                // const quizCorrectAnswers = [];
// const studentQuizAnswers = [];

                quizCorrectAnswers.forEach(ans => {

                  console.log(ans)
                    const correctOptDiv = document.createElement('div');
                    correctOptDiv.className = 'p-4 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center mt-4';
                    const studentAnswer = studentQuizAnswers.find(a => a.question_id === ans.question_id);
                    const isCorrect = studentAnswer && studentAnswer.selected_option_id === ans.correct_option_id;
                    
                    correctOptDiv.innerHTML = `
                      <div class="text-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm">
                      
                      
                      
                      ${
                        //if correct render green mark, otherwise red 
                        isCorrect ? 
                            '<div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>' 
                            : 
                            '<div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></div>'

                      }
                    
                     
                        <p class="mb-4 font-bold text-slate-800 text-lg">${ans.question_id}. ${ans.question_title}</p>
                        <div class="options-list space-y-2">
                        <span class="text-slate-700">Your Answer:</span> 
                        ${studentAnswer ? `Option ${studentAnswer.selected_option_id}` : 'No answer'} 
                        <div>
                        Correct: Option ${ans.correct_option_id}
                        </div>
                        </div>
                         
                    </div>                    

                    `;

                    quizAnswersContainer.appendChild(correctOptDiv); 
                })
                
                quizDetailsModal.classList.remove('hidden')

            }
        });

        questionDiv.appendChild(actionBtn);
        quizContainer.appendChild(questionDiv);
    });
});

socket.on('submit_quiz_answers_response', (data) => {
    console.log(`Student - Server Response:`, data);
});

socket.on('submit_quiz_answers_error', (data) => {
    console.error(`Student - Error:`, data.message);
    alert("Submission Error: " + data.message);
});

// INITIAL CONNECTION
socket.on('connect', () => {
    console.log(`${studentId}: Connected to Gateway`); 
    AttendanceCheckIn();
    startTelemetrySession()
});

window.addEventListener('beforeunload', () => {
    stopTelemetrySession();
});