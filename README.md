EduStream - Smart Automated Education Environment
=================================================

EduStream is a distributed systems project built for the NCI Distributed Systems CA. It is aligned with the **United Nations Sustainable Development Goal 4: Quality Education**.

The platform provides a "Smart Automated Environment" for real-time lecture management, bridging the gap between in-person and remote learning through a Microservices Architecture.


🏗️ System Architecture
-----------------------

1.  **Client Tier**: Web portals for Professors and Students (Tailwind CSS).

2.  **Gateway Tier**: Node.js server acting as a protocol translator (WebSockets to gRPC).

3.  **Service Tier**: Independent gRPC microservices.

4.  **Naming Tier**: Bonjour mDNS for dynamic network addressing.

🚀 Getting Started
------------------

### 1\. Prerequisites

Ensure you have [Node.js](https://nodejs.org/ "null") installed.

### 2\. Installation

Run the following command in the root directory to install necessary dependencies:

```
npm install @grpc/grpc-js @grpc/proto-loader express socket.io bonjour-service

```

### 3\. Running the System

To run the full distributed environment, you must open **four separate terminals**:

#### Terminal 1: Attendance Service (Port 50051)

```
cd services/attendance-service
node attendance_app.js

```

#### Terminal 2: Quiz Service (Port 50052)

```
cd services/quiz-service
node quiz_app.js

```

#### Terminal 3: Telemetry Service (Port 50053)

```
cd services/telemetry-service
node telemetry_app.js

```

#### Terminal 4: Server Gateway (Port 3003)

```
cd gateway
node server_gateway.js

```

Once all services are running, open your browser at `http://localhost:3003`.

📁 Project Structure
--------------------

```
.
├── gateway/
│   ├── public/              # Professor & Student Portals (HTML/JS)
│   ├── proto/               # Shared .proto definitions
│   └── server_gateway.js    # BFF / API Gateway
└── services/
    ├── attendance-service/  # Student Check-in & Live Roster
    ├── quiz-service/        # Quiz Activation & Live Monitoring
    └── telemetry-service/   # Engagement Pings & Analytics

```

🧪 Testing Scenarios
--------------------

1.  **Discovery**: Check the Gateway terminal. You should see logs indicating that the `Education-Quiz-Service`, `Attendance-Service`, and `Telemetry-Service` were discovered via Bonjour.

2.  **Attendance**: Login as a student (ID 1-4). Check the Professor Portal; the status should change to "Online" instantly via Server-Side Streaming.

3.  **Quizzes**: As a Professor, click "Start Quiz". As a Student, refresh to see questions. Submit answers and watch the Professor's "Live Monitor" update via Bidirectional Streaming.

4.  **Telemetry**: Move your mouse or click on the student page. Log out or disconnect to see the Telemetry Service terminal log the captured engagement count via Client-Side Streaming.

🎓 Author
---------

**Pedro Moreira** Student ID: 22140034

National College of Ireland

[GitHub Repository](https://github.com/Pedro-Ribas-Moreira/NCI_DistributedSystems_CA "null")
