const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to proto file
const PROTO_PATH = path.join(__dirname, './proto/education.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const educationProto = grpc.loadPackageDefinition(packageDefinition).education;
// Create client
const client = new educationProto.EducationService(
  'localhost:50053',
  grpc.credentials.createInsecure()
);

//   rpc StudentAttendenceCheckIn (StudentCheckIn) returns (StudentCheckInResponse); //DONE



const requestMessage = {
  student_id: '2' ,
  student_location: 'Remote',
}; 

 
// Make request to server
client.StudentAttendenceCheckIn(requestMessage, (error, response) => {
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Received response:', response.confirmation_response);
});




const quizRequest = {
  quiz_id: '1' ,
  student_id: '2'
}; 

 
// Make request to server
client.StudentQuizRequest(quizRequest, (error, response) => {
  if (error) {
    console.error('Error:', error.message);
    return;
  }

    console.log('--- ACTIVE QUIZ DETAILS ---');
    console.log(`Quiz ID: ${response.quiz_id}`);
    console.log(`Quiz Title: ${response.quiz_title}`);
    console.log('Quiz Questions:');
    response.quiz_questions.forEach((question, index) => {
        console.log(`  ${index + 1}. ${question}`);
    });
    console.log(`Message from Server: ${response.message}`);
}   )
;





//   rpc StudentTelemetry (stream StudentTelemetryRequest) returns (StudentTelemetryResponse);
// Initiate the stream
// set interval, every 5 seconds, send a telemetry message to the server
// message with following data: 
// message StudentTelemetryRequest {
//   string student_id = 1;
//   string activity_type = 2;
//   string activity_timestamp = 3;
// }
// activity_type can be: "joined_class", "left_class", "started_quiz", "completed_quiz", "asked_question", "answered_question"
// make it random for testing purposes
// on end or error log response from server from 

// message StudentTelemetryResponse {
//   string student_id = 1;
//   string telemetry_status = 2;
//   string message = 3;
// }

// 1. Start the Client-Side stream. 
// We assign the execution to 'telemetryStream' so we can write to it below.
const telemetryStream = client.StudentTelemetry((error, response) => {
    if (error) {
        console.error('Telemetry Stream Error:', error.message);
        return;
    }
    
    // This logs the single response sent from the server after the stream ends
    console.log('\n--- SESSION SUMMARY FROM SERVER ---');
    console.log(`Student ID: ${response.student_id}`);
    console.log(`Status: ${response.telemetry_status}`);
    console.log(`Message: ${response.message}`);
});

function getRandomActivityType() {
    const activityTypes = [
        'joined_class',
        'left_class',
        'started_quiz',
        'completed_quiz',
        'asked_question',
        'answered_question'
    ];
    return activityTypes[Math.floor(Math.random() * activityTypes.length)];   
}

// 2. Simulate streaming data every 5 seconds
let pingCount = 0;
const maxPings = 5; // Let's stop after 5 events to see the server's final response

const heartbeat = setInterval(() => {
    pingCount++;
    
    const telemetryMessage = {
        student_id: '2',
        activity_type: getRandomActivityType(),
        activity_timestamp: new Date().toISOString(),
    };
    
    console.log(`-> Sending telemetry [${pingCount}/${maxPings}]: ${telemetryMessage.activity_type}`);
    
    // Write data to the stream
    telemetryStream.write(telemetryMessage);

    // End the lecture stream after hitting our max pings
    if (pingCount === maxPings) {
        clearInterval(heartbeat);
        console.log('[CLIENT] Session ended. Closing telemetry stream...');
        
        // IMPORTANT: This tells the server we are done, triggering the server's final response callback!
        telemetryStream.end(); 
    }
}, 5000);