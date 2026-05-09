// 1. Connect to the Unified Gateway via WebSocket
const socket = io();

// 2. Get Student Info from Session Storage (set during login)
const studentId = sessionStorage.getItem('currentUserId');
const studentName = sessionStorage.getItem('currentUserName') || 'Student';
const checkInStatusDiv = document.getElementById('checkin-status');
const checkInBtn = document.getElementById('checkin-btn');

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




// LIVE CONNECTION LOGGING
// Basic connection log
socket.on('connect', () => {
    console.log(studentId + ": Connected to Gateway with ID:", socket.id); 
    AttendanceCheckIn();
});