// 1. Connect to the Unified Gateway via WebSocket
const socket = io();

// 2. Get Student Info from Session Storage (set during login)
const studentId = sessionStorage.getItem('currentUserId');
const studentName = sessionStorage.getItem('currentUserName') || 'Student';
const checkInStatusDiv = document.getElementById('checkin-status');
const checkInBtn = document.getElementById('checkin-btn');
const startQuizBtn = document.getElementById('start-quiz-btn');

let quizAnswers = []
console.log(`Student ID: ${studentId}) --- STUDENT DASHBOARD LOADED FOR: ${studentName}`);

// ========================================================
// 1. ATTENDANCE CHECK-IN ON LOAD
// ========================================================


function AttendanceCheckIn() {
    console.log(studentId + ": Sending check-in request to gateway...");
    
    const checkInData = {
        student_id: studentId,
        student_location: "Dublin, IE (Remote)" 
    };

    socket.emit('student_checkin', checkInData);
}


socket.on('checkin_success', (response) => {
    console.log(studentId + ": Check-in confirmed:", response);
    // create a temp alert to show the check-in was successful
    alert(response.confirmation_response);
    

});

socket.on('checkin_error', (data) => {
    console.error(studentId + ": Check-in failed:", data.message);
    alert("Check-in failed: " + data.message + "\nPlease try again or contact support.");

});

// ========================================================
// 2. REAL-TIME ACTIVITY TELEMETRY
// ======================================================== 

let lastActivityTime = Date.now();
let lastEventName = "page_load"; 

// List of events to listen for
const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart', 'focus', 'visibilitychange'];

activityEvents.forEach(event => {
    window.addEventListener(event, () => {
        lastActivityTime = Date.now();
        lastEventName = event; // Capture the specific event type
    });
});

// Start the Telemetry stream once
socket.emit('send_telemetry_ping', { student_id: studentId, activity_type: 'page_load', activity_timestamp: new Date().toISOString() });

// Check for activity every minute
setInterval(() => {
    const now = Date.now();
    const inactivityDuration = now - lastActivityTime;
    
    // Determine the status based on your 5-minute rule
    // 300,000 ms = 5 minutes
    const isInactive = inactivityDuration > (5 * 60 * 1000);
    
    let telemetryData = {
        student_id: studentId,
        activity_type: isInactive ? "inactive" : lastEventName,
        activity_timestamp: new Date().toISOString()
    };

    console.log(`Student - [TELEMETRY] Sending status: ${telemetryData.activity_type}`);
    
    // Send the ping to the Gateway
    socket.emit('send_telemetry_ping', telemetryData);

}, 20 * 1000);

// telemetry response listener
socket.on('telemetry_response', (data) => {
    console.log(`Student - [TELEMETRY] Received response from Gateway:`, data);

});
// telemetry error
socket.on('telemetry_error', (data) => {
    console.error(`Student - [TELEMETRY] Error from Gateway:`)
    console.error(data);
  
});


// QUIZ ACTIVATION

   startQuizBtn.addEventListener('click', () => {
      console.log("Student - Quiz requested, sending request to Gateway...");
      // This will be triggered when the professor starts the quiz
      // You can add any UI changes here to indicate the quiz has started
      document.getElementById('quiz-container').classList.remove('hidden');
      
      // ask server for quiz questions
      socket.emit('request_quiz_questions', { quiz_id: 1, student_id: studentId  });
    });

    // Listen for quiz questions from the server
    socket.on('quiz_questions', (data) => {
        console.log("Received quiz questions from server:", data);
        const quizContainer = document.getElementById('quiz-container');
        quizContainer.innerHTML = `<h2 class="text-xl font-bold mb-4">${data.quiz_title}</h2>`;
        
        data.quiz_questions.forEach((q, index) => {

            console.log(q.options)
            const questionDiv = document.createElement('div');
            questionDiv.className = 'quiz-questions-containers hidden mb-6 p-4 border rounded bg-white shadow';
            questionDiv.innerHTML = `
                <p class="mb-2 cursor-pointer font-medium">${index + 1}. ${q.question}</p>
                ${q.options.map(opt => `<button class="option-btn  w-full text-left px-3 py-2 mb-2 border rounded hover:bg-slate-100 cursor-pointer " data-question-id="${q.question_id}" data-option="${opt.option_id}">${opt.option_title}</button>`).join('')}
            `;
            document.querySelectorAll('.option-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                  console.log(e.target);
                    
                  
                   // highlight selected option
                   //not working in the last question for some reason, need to debug
                   
                    const buttons = questionDiv.querySelectorAll('.option-btn');
                    buttons.forEach(btn => btn.classList.remove('bg-blue-100'));
                   
                    e.target.classList.add('bg-blue-100');

                    // store the answer in a local variable (quuizAnswers) to be sent to the server when the quiz is submitted
                    const selectedOption = e.target.getAttribute('data-option');
                    const questionId = e.target.getAttribute('data-question-id');

                    // remove previous answer for the same question
                    quuizAnswers = quuizAnswers.filter(ans => ans.question_id !== questionId); 

                    quuizAnswers.push({ question_id: questionId, selected_option_id: selectedOption });
                    console.log("Current quiz answers:", quuizAnswers);

                });
            });
            const quizNextBtn = document.createElement('button');
            quizNextBtn.textContent = "Confirm Answer";
            quizNextBtn.className = 'w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded transition shadow';

            // add a function to the quizNextBtn to go to the next question when clicked, if is the last child of quizContainer, hide the button instead and display a SUBMIT ANSWER button
            quizNextBtn.addEventListener('click', () => {
                const currentQuestion = questionDiv;
                const nextQuestion = currentQuestion.nextElementSibling;
                
                if (nextQuestion) {
                    currentQuestion.classList.add('hidden');
                    nextQuestion.classList.remove('hidden');
                } else {
                    // No more questions, hide the next button and show submit button
                    quizNextBtn.style.display = 'none';
                    const submitBtn = document.createElement('button');
                    submitBtn.textContent = "Submit Answers";
                    submitBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition shadow mt-4';
                    submitBtn.addEventListener('click', () => {
                        console.log("Submitting quiz answers to server:", quizAnswers);

                        socket.emit('submit_quiz_answers', { student_id: studentId, quiz_id: data.quiz_id, submitted_answers: quizAnswers });
                        // Here you would typically send the answers back to the server
                    });
                    questionDiv.appendChild(submitBtn);
                }
            });
            questionDiv.appendChild(quizNextBtn);
            
            quizContainer.appendChild(questionDiv);
          });


          socket.on('submit_quiz_answers_response', (data) => {
            console.log(`Student - Received quiz submission response from server:`, data);
            alert(data.message);
          } );

          socket.on('submit_quiz_answers_error', (data) => {
            console.error(`Student - Error submitting quiz answers:`, data);
            alert("Error submitting quiz answers: " + data.message);
          });


        document.querySelector('.quiz-questions-containers').classList.remove('hidden'); // Show the first question container

        // Add event listeners to option buttons
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const selectedOption = e.target.getAttribute('data-option');
                const questionId = e.target.getAttribute('data-question-id');
                console.log(`Selected option for question ${questionId}: ${selectedOption}`);
                // Here you would typically send the selected answer back to the server
                // For this example, we'll just log it to the console
            });
        });


    });     
         






// LIVE CONNECTION LOGGING
// Basic connection log
socket.on('connect', () => {
    console.log(studentId + ": Connected to Gateway with ID:", socket.id); 
    AttendanceCheckIn();
});