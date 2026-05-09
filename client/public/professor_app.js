// Connect to this gateway
const socket = io(); 

const rosterDiv = document.getElementById('student-roster');
const startQuizBtn = document.getElementById('start-quiz-btn');
const monitorQuizBtn = document.getElementById('monitor-quiz-btn');

const studentCountTotal = document.getElementById('students-online-total');

const updateStudentCount = (count) => {
    studentCountTotal.textContent = count;
}

function startQuiz() {
    console.log("activate quiz")
    // This tells the Gateway to run the 'activate_quiz' gRPC function
    socket.emit('activate_quiz', { professor_id: 'prof_123', quiz_id: 1 });
}

// Listen for the success response from the Gateway
socket.on('quiz_activation_success', (data) => {
    console.log("Success: Quiz started: " + data.message);
    monitorQuizBtn.disabled = false; // 

    
    startQuizBtn.disabled = true; //
    console.log(startQuizBtn);

});

socket.on('quiz_activation_error', (data) => {
    console.error("ERROR: Quiz activation failed: " + data.message);
    startQuizBtn.disabled = false; // Re-enable the "Start Quiz" button
});
    


console.log(`Professor - Requesting initial roster...`);
socket.emit('start_roster_stream', { professor_id: 'prof_123' });

// --- LISTEN FOR UPDATES ---
socket.on('roster_update', (data) => {
    let studentsOnlineCounter = 0;
    console.log("Professor - Roster update received:", data);
    console.log(`Professor - Roster data:`, data);  

    // Clear the "Waiting..." message
    rosterDiv.innerHTML = '';
    console.log(`Professor - Student attendance info:`, data.student_attendance_info);
    if (data.student_attendance_info && data.student_attendance_info.length > 0) {
        data.student_attendance_info.forEach(student => {
            const li = document.createElement('li');
            li.className = 'p-3 border-b border-slate-200 flex items-center justify-between bg-white hover:bg-slate-50 transition';
            
            const isOnline = student.check_in_status === true;
            const dotColor = isOnline ? 'bg-green-500' : 'bg-slate-300';
            if(isOnline) studentsOnlineCounter++;
            li.innerHTML = `
                <span class="text-slate-700 font-medium">${student.student_name}</span>
                <span class="w-2 h-2 rounded-full ${dotColor}"></span>
            `;
            rosterDiv.appendChild(li);
        });
    } else {
        rosterDiv.innerHTML = '<li class="p-4 text-center text-slate-400 italic">No students found.</li>';
    }
    updateStudentCount(studentsOnlineCounter);
});






// Basic Error Handling
socket.on('connect_error', () => {
    console.error("Professor - Gateway connection failed. Is express_middleware running?");
});