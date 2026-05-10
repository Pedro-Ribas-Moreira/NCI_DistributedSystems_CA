const socket = io();

// ==========================================
// 1. SETUP & STATE
// ==========================================
const studentId = sessionStorage.getItem('currentUserId');
const studentName = sessionStorage.getItem('currentUserName') || 'Student';

// DOM Elements
const startQuizBtn = document.getElementById('start-quiz-btn');
const quizContainer = document.getElementById('quiz-container');
const quizDetailsModal = document.getElementById('quiz-details-modal');
const quizAnswersContainer = document.getElementById('quiz-answers-container');

// State Variables
let activeQuiz;
const quizCorrectAnswers = [];
const studentQuizAnswers = [];

// Telemetry State
let lastActivityTime = Date.now();
let lastEventName = "page_load"; 
let telemetryInterval = null;
const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart', 'focus', 'visibilitychange'];

console.log(`Student ID: ${studentId} --- DASHBOARD LOADED`);

// ==========================================
// 2. SOCKET LIFECYCLE
// ==========================================
socket.on('connect', () => {
    console.log(`${studentId}: Connected to Gateway`); 
    AttendanceCheckIn();
    startTelemetrySession();
});

window.addEventListener('beforeunload', () => {
    stopTelemetrySession();
});

// ==========================================
// 3. ATTENDANCE MODULE
// ==========================================
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

socket.on('checkin_error', (err) => {
    console.error(err);
});

// ==========================================
// 4. TELEMETRY MODULE (Activity Tracking)
// ==========================================
activityEvents.forEach(event => {
    window.addEventListener(event, () => {
        lastActivityTime = Date.now();
        lastEventName = event;
    });
});

function startTelemetrySession() {
    console.log("[TELEMETRY] Starting new engagement session...");
    socket.emit('start_telemetry_session', { student_id: studentId });
    
    // Initial ping
    socket.emit('send_telemetry_ping', { 
        student_id: studentId, 
        activity_type: 'session_start', 
        activity_timestamp: new Date().toISOString() 
    });

    // Activity interval
    telemetryInterval = setInterval(() => {
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

function stopTelemetrySession() {
    console.log("Student - [TELEMETRY] Closing session to request summary...");
    if (telemetryInterval) clearInterval(telemetryInterval);
    socket.emit('stop_telemetry_session');
}

socket.on('telemetry_summary', (data) => {
    console.log(`\n--- LECTURE SUMMARY ---`);
    console.log(data.message);
});

// ==========================================
// 5. QUIZ MODULE
// ==========================================

// Request Quiz
if (startQuizBtn) {
    startQuizBtn.addEventListener('click', () => {
        console.log("Student - Requesting quiz questions...");
        quizContainer.classList.remove('hidden');
        startQuizBtn.disabled = true;
        startQuizBtn.style.display = 'none';
        socket.emit('request_quiz_questions', { quiz_id: 1, student_id: studentId });

         socket.emit('start_quiz_monitor_stream', { professor_id: 'STUDENT', quiz_id: 1, message: `${studentId} subscribing for feedback` });
    });
}


socket.on('quiz_monitor_update', (data) => {
    console.log("Student - Live update received:", data);
    if(data.qu)

    if(data.type === 'Feedback'){
        showProfessorFeedbackMessage(data.message)
    }
});



function showProfessorFeedbackMessage(text) {
    // 1. Create the notification element
    const feedbackMessage = document.createElement('div');
    
    // Applying Tailwind-like classes for a sleek look
    feedbackMessage.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-100 w-[90%] max-w-md bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center animate-slide-down';
    
    feedbackMessage.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="bg-blue-500 p-2 rounded-lg">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            </div>
            <div>
                <p class="text-xs font-bold uppercase tracking-wider opacity-80">Professor Feedback</p>
                <p class="font-medium">${text}</p>
            </div>
        </div>
        <button class="ml-4 hover:bg-blue-700 p-1 rounded-full transition-colors" id="close-feedbackMessage">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;

    document.body.appendChild(feedbackMessage);

    const closeBtn = feedbackMessage.querySelector('#close-feedbackMessage');
    const removefeedbackMessage = () => {
        feedbackMessage.classList.replace('animate-slide-down', 'animate-fade-out');
        setTimeout(() => feedbackMessage.remove(), 300);
    };

    closeBtn.onclick = removefeedbackMessage;

    // 4. Auto-remove after 8 seconds if the student doesn't close it
    setTimeout(removefeedbackMessage, 8000);
}




// Receive Questions and Render
socket.on('quiz_questions', (data) => {
    console.log("Received quiz questions:", data);

    if(data.quiz_questions.length > 1){
        quizContainer.innerHTML = `<h2 class="text-xl font-bold mb-4 text-blue-600">Quiz not active yet!</h2>`;

        startQuizBtn.disabled = false;
        startQuizBtn.style.display = 'block';

        return
    }
    data.quiz_questions.forEach(q => {
        quizCorrectAnswers.push({
            question_id: q.question_id,
            question_title: q.question,
            correct_option_id: q.correct ? q.correct.option_id : null, 
            correct_option_title: q.correct ? q.correct.option_title : null
        });
    }); 

    quizContainer.innerHTML = `<h2 class="text-xl font-bold mb-4 text-blue-600">${data.quiz_title}</h2>`;
    const totalQuestions = data.quiz_questions.length;

    data.quiz_questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
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
                optionButtons.forEach(b => {
                    b.classList.remove('bg-blue-50', 'border-blue-500', 'ring-2', 'ring-blue-200');
                    b.querySelector('div').className = 'w-4 h-4 rounded-full border-2 border-slate-200 transition-colors';
                });
                
                const currentBtn = e.currentTarget;
                currentBtn.classList.add('bg-blue-50', 'border-blue-500', 'ring-2', 'ring-blue-200');
                currentBtn.querySelector('div').className = 'w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-500 transition-colors';
                
                selectedOptionId = currentBtn.getAttribute('data-option');
            });
        });

        // Next/Submit Logic
        const actionBtn = document.createElement('button');
        const isLast = index === totalQuestions - 1;
        actionBtn.textContent = isLast ? "Submit Final Answer" : "Confirm & Next Question";
        actionBtn.className = `w-full mt-6 ${isLast ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold py-3 px-4 rounded-xl transition shadow-lg`;

        actionBtn.addEventListener('click', () => {
            if (!selectedOptionId) {
                alert("Please select an answer first!");
                return;
            }

            studentQuizAnswers.push({
                question_id: q.question_id,
                selected_option_id: parseInt(selectedOptionId)
            });

            socket.emit('submit_quiz_answers', { 
                student_id: studentId, 
                quiz_id: data.quiz_id, 
                submitted_answers: {
                    question_id: parseInt(q.question_id),
                    selected_option_id: parseInt(selectedOptionId)
                } 
            });

            questionDiv.classList.add('hidden');
            const nextDiv = questionDiv.nextElementSibling;
            
            if (nextDiv && nextDiv.classList.contains('quiz-question-block')) {
                nextDiv.classList.remove('hidden');
            } else {
                // Quiz End View
                quizContainer.innerHTML = `
                    <div class="text-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h3 class="text-xl font-bold text-slate-800">Quiz Completed!</h3>   
                    </div>
                `;

                // Render Results in Modal
                quizCorrectAnswers.forEach(ans => {
                    const correctOptDiv = document.createElement('div');
                    const studentAnswer = studentQuizAnswers.find(a => a.question_id === ans.question_id);
                    const isCorrect = studentAnswer && studentAnswer.selected_option_id === ans.correct_option_id;
                    
                    correctOptDiv.innerHTML = `
                      <div class="text-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm mt-4">
                        ${isCorrect ? 
                            '<div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>' : 
                            '<div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></div>'
                        }
                        <p class="mb-4 font-bold text-slate-800 text-lg">${ans.question_id}. ${ans.question_title}</p>
                        <div class="options-list space-y-2">
                            <span class="text-slate-700">Your Answer: ${studentAnswer ? `Option ${studentAnswer.selected_option_id}` : 'No answer'}</span> 
                            <div>Correct: Option ${ans.correct_option_id}</div>
                        </div>
                      </div>`;
                    quizAnswersContainer.appendChild(correctOptDiv); 
                });
                quizDetailsModal.classList.remove('hidden');
            }
        });

        questionDiv.appendChild(actionBtn);
        quizContainer.appendChild(questionDiv);
    });
});

// Submission Listeners
socket.on('submit_quiz_answers_response', (data) => {
    console.log(`Student - Server Response:`, data);
});

socket.on('submit_quiz_answers_error', (data) => {
    console.error(`Student - Error:`, data.message);
    alert("Submission Error: " + data.message);
});

socket.on('connect_error', () => {
    console.error("Gateway connection lost.");
});