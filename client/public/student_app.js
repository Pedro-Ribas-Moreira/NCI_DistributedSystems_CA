// 1. Connect to the Unified Gateway via WebSocket
const socket = io();

// 2. Get Student Info from Session Storage (set during login)
const studentId = sessionStorage.getItem('currentUserId');
const studentName = sessionStorage.getItem('currentUserName') || 'Student';
const checkInStatusDiv = document.getElementById('checkin-status');
const checkInBtn = document.getElementById('checkin-btn');

console.log(`--- STUDENT DASHBOARD LOADED FOR: ${studentName} (ID: ${studentId}) ---`);

// ========================================================
// 1. AUTOMATIC CHECK-IN ON LOAD
// ========================================================

/**
 * We trigger the check-in as soon as the page loads.
 * In a real-world hybrid app, we might also send GPS coordinates 
 * or "Remote" status here.
 */
function performCheckIn() {
    console.log("[UI] Sending check-in request to gateway...");
    
    const checkInData = {
        student_id: studentId,
        class_id: "DS_2026_NCI", // Hardcoded for this CA
        location: "Dublin, IE (Remote)" 
    };

    socket.emit('student_checkin', checkInData);
}

// Trigger on load
performCheckIn();

// Manual check-in button listener (backup)
checkInBtn.addEventListener('click', () => {
    checkInStatusDiv.innerText = "Status: Re-checking in...";
    performCheckIn();
});

// ========================================================
// 2. GATEWAY RESPONSE LISTENERS
// ========================================================

socket.on('checkin_success', (response) => {
    console.log("[GATEWAY] Check-in confirmed:", response);
    
    // Update UI
    checkInStatusDiv.innerText = "Status: Checked In ✅";
    checkInStatusDiv.classList.replace('bg-slate-50', 'bg-green-100');
    checkInStatusDiv.classList.replace('text-slate-600', 'text-green-700');
    
    // Disable button once checked in
    checkInBtn.innerText = "Check-In Confirmed";
    checkInBtn.disabled = true;
    checkInBtn.classList.add('opacity-50', 'cursor-not-allowed');
});

socket.on('checkin_error', (data) => {
    console.error("[GATEWAY] Check-in failed:", data.message);
    checkInStatusDiv.innerText = "Status: Error (" + data.message + ")";
    checkInStatusDiv.classList.add('bg-red-100', 'text-red-700');
});

// Basic connection log
socket.on('connect', () => {
    console.log("[SOCKET] Connected to Gateway with ID:", socket.id);
});