const socket = io();

// ==========================================
// 1. DOM SELECTORS
// ==========================================
// Roster / Sidebar
const rosterDiv = document.getElementById('student-roster');
const studentCountTotal = document.getElementById('students-online-total');

// Quiz Control
const startQuizBtn = document.getElementById('start-quiz-btn');
const monitorQuizBtn = document.getElementById('monitor-quiz-btn');

// Monitoring Dashboard
const monitorContainer = document.getElementById('monitor-container');
const quizResponsesDiv = document.getElementById('quiz-responses');

// Feedback
const feedbackMessage = document.getElementById('professor-msg');
const feedbackContainer = document.getElementById('feedback-container');

// Modal Details
const detailsModal = document.getElementById('details-modal');
const detailsContent = document.getElementById('details-content');
const detailsName = document.getElementById('details-name');

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
let onlineStudentsMap = new Map();      // Student IDs -> Names
let studentQuizProgressMap = new Map(); // Student IDs -> Progress/Answers
const listFeedbackMessages = [];        // Local history of sent messages
let currentQuiz = {};

// ==========================================
// 3. INITIALIZATION
// ==========================================
console.log(`Professor - Requesting class roster stream...`);
socket.emit('start_roster_stream', { professor_id: 'prof_123' });

// ==========================================
// 4. ATTENDANCE / ROSTER LOGIC
// ==========================================
socket.on('roster_update', (data) => {
    let onlineCount = 0;
    rosterDiv.innerHTML = '';
    
    if (data.student_attendance_info && data.student_attendance_info.length > 0) {
        data.student_attendance_info.forEach(student => {
            onlineStudentsMap.set(student.id, student.student_name);
            const isOnline = student.check_in_status === true;
            if (isOnline) onlineCount++;
            
            const li = document.createElement('li');
            li.className = 'p-3 border-b border-slate-100 flex items-center justify-between bg-white hover:bg-slate-50 transition rounded-lg';
            li.innerHTML = `
                <span class="text-slate-700 font-medium">${student.student_name}</span>
                <span class="w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}"></span>
            `;
            rosterDiv.appendChild(li);
        });
    } else {
        rosterDiv.innerHTML = '<li class="p-4 text-center text-slate-400 italic">No students found.</li>';
    }
    
    if (studentCountTotal) {
        studentCountTotal.textContent = onlineCount;
    }
});

// ==========================================
// 5. QUIZ ACTIVATION LOGIC
// ==========================================
if (startQuizBtn) {
    startQuizBtn.addEventListener('click', () => {
        console.log("Professor - Activating quiz...");
        startQuizBtn.disabled = true;
        startQuizBtn.innerText = "Activating...";
        socket.emit('activate_quiz', { professor_id: 'prof_123', quiz_id: 1 });
    });
}

socket.on('quiz_activation_success', (data) => {
    console.log("Professor - Quiz active success:", data.message);
    if (startQuizBtn) {
        startQuizBtn.innerText = "Quiz Active!";
        startQuizBtn.className = "w-full bg-green-600 text-white font-bold py-3 px-4 rounded transition shadow mb-3 opacity-50 cursor-not-allowed";
    }
    if (monitorQuizBtn) monitorQuizBtn.disabled = false;
});

socket.on('quiz_activation_error', (data) => {
    console.error("Professor - Activation error:", data.message);
    alert("Could not start quiz: " + data.message);
    if (startQuizBtn) {
        startQuizBtn.disabled = false;
        startQuizBtn.innerText = "Start Quiz";
    }
});

// ==========================================
// 6. QUIZ MONITORING & CARDS
// ==========================================
if (monitorQuizBtn) {
    monitorQuizBtn.addEventListener('click', () => {
        if (monitorContainer) monitorContainer.classList.remove('hidden');
        console.log(`Professor - Initiating quiz monitoring stream...`);
        socket.emit('start_quiz_monitor_stream', { 
            professor_id: 'prof_123',
            student_id: '',
            quiz_id: 1,
            message: '',
            type: 'InitialRequest'
        });
    });
}

socket.on('quiz_monitor_update', (data) => {
    console.log("Professor - Live update received:", data);
    if(!data.student_id) return;

    const sid = data.student_id;
    const sName = onlineStudentsMap.get(sid) || `Student ${sid}`;
    
    studentQuizProgressMap.set(sid, {
        name: sName,
        answers: data.submitted_answers || [],
        total: 5 
    });

    renderMonitorCards();
});

function renderMonitorCards() {
    if (!quizResponsesDiv || studentQuizProgressMap.size === 0) return;
    quizResponsesDiv.innerHTML = '';

    studentQuizProgressMap.forEach((student, sid) => {
        const count = student.answers.length;
        const total = 5;
        const isFinished = count >= total;

        const card = document.createElement('div');
        card.className = `p-4 rounded-xl border bg-white shadow-sm cursor-pointer transition transform hover:scale-[1.02] ${isFinished ? 'border-green-200 bg-green-50' : 'border-slate-200'}`;
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-bold text-slate-800">${student.name}</h3>
                ${isFinished ? '<span class="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">DONE</span>' : ''}
            </div>
            <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-2">
                <div class="bg-blue-600 h-full transition-all duration-500" style="width: ${(count/total)*100}%"></div>
            </div>
            <p class="text-xs font-bold ${isFinished ? 'text-green-600' : 'text-slate-500'}">
                Progress: ${count} / ${total}
            </p>
        `;
        card.onclick = () => showStudentDetails(sid);
        quizResponsesDiv.appendChild(card);
    });
}

function showStudentDetails(sid) {
    const studentData = studentQuizProgressMap.get(sid);
    if (!studentData) return;

    if (detailsName) detailsName.innerText = `Details: ${studentData.name}`;
    if (detailsContent) {
        detailsContent.innerHTML = '';
        if (studentData.answers.length === 0) {
            detailsContent.innerHTML = '<p class="text-slate-400 italic text-sm py-4 text-center">No answers yet.</p>';
        } else {
            studentData.answers.forEach(ans => {
                const row = document.createElement('div');
                row.className = 'p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center';
                row.innerHTML = `
                    <span class="text-slate-500 text-sm font-medium italic">Question ${ans.question_id}</span>
                    <span class="text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded">Option ${ans.selected_option_id}</span>
                `;
                detailsContent.appendChild(row);
            });
        }
    }
    if (detailsModal) detailsModal.classList.remove('hidden');
}

// ==========================================
// 7. LIVE FEEDBACK LOGIC
// ==========================================
const sendLiveFeedback = () => {
    const msg = feedbackMessage.value;
    const timestamp = getTimeStamp();
    
    listFeedbackMessages.push({msg: msg, timestamp: timestamp});
    feedbackContainer.innerHTML = '';

    socket.emit('start_quiz_monitor_stream', { 
         professor_id: 'prof_123',
         student_id: '',
         quiz_id: 1,
         message: msg,
         type: 'Feedback'
     });

    listFeedbackMessages.forEach((item) => {
        const msgLi = document.createElement('li');
        msgLi.className = 'p-3 border-b border-slate-100 flex items-center justify-between bg-blue-100 hover:bg-slate-50 transition rounded-lg';
        msgLi.innerHTML = `
          <span class="text-slate-700 font-medium">${item.msg}</span>
          <span class="text-xs">${item.timestamp}</span>`;
        feedbackContainer.appendChild(msgLi);
    });
    feedbackMessage.value = '';
};

// ==========================================
// 8. UTILITIES & ERROR HANDLING
// ==========================================
const getTimeStamp = () => {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
};

socket.on('quiz_monitor_error', (data) => {
    console.error("Monitor Error:", data.message);
    alert("Monitoring error: " + data.message);
});

socket.on('connect_error', () => {
    console.error("Gateway connection lost.");
});