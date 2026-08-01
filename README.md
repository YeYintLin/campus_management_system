# Smart Campus Management System (MERN Microservices)

This repository implements a **decoupled, database-isolated microservices architecture** for a Smart Campus Management System (CMS). The codebase is divided into independent service components coordinated by an API Gateway.

---

## 1. System Architecture Overview

The system consists of the following independently runnable services:
*   **`/gateway`:** API Gateway running on Port `5001`. Serves as the single public entry point, logging, proxying, and forwarding client requests to internal services without path stripping.
*   **`/services/core`:** Core Service running on Port `5002`. Manages users, student profiles, courses, grades, exams, timetables, and notification registries. Connects to `core_db`.
*   **`/services/attendance`:** Attendance Service running on Port `5003`. Handles student attendance grids, resolves student names dynamically via REST calls to the Core Service, and connects to `attendance_db`.
*   **`/services/ai`:** AI Service running on Port `5004`. Integrates the Gemini API helper models and saves dynamic prompt setups to `ai_db`.
*   **`/frontend`:** Client React application running on Port `5173` (dev) or Port `8050` (production). Communicates exclusively through the Port 5001 API Gateway.

---

## 2. Environment Configuration

Each microservice requires a local `.env` configuration file to run. 

### 2.1 API Gateway Env (`gateway/.env`)
```env
PORT=5001
CORE_SERVICE_URL=http://localhost:5002
ATTENDANCE_SERVICE_URL=http://localhost:5003
AI_SERVICE_URL=http://localhost:5004
```

### 2.2 Core Service Env (`services/core/.env`)
```env
PORT=5002
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/core_db
JWT_SECRET=your_jwt_signing_key_here
```

### 2.3 Attendance Service Env (`services/attendance/.env`)
```env
PORT=5003
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/attendance_db
JWT_SECRET=your_jwt_signing_key_here
CORE_SERVICE_URL=http://localhost:5002
```

### 2.4 AI Service Env (`services/ai/.env`)
```env
PORT=5004
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ai_db
JWT_SECRET=your_jwt_signing_key_here
OLLAMA_API_URL=http://localhost:11434
```
*(Ensure the `JWT_SECRET` key values are completely identical across Core, Attendance, and AI services to ensure token decoding compatibility).*

---

## 3. Database Seeding Instructions

To populate your MongoDB databases with mock mechatronics coursework data, run these commands from the **project root folder**:

1.  **Seed User Accounts & Profiles:**
    ```bash
    npm --prefix services/core run seed:users
    ```
2.  **Seed Courses & Grades:**
    ```bash
    npm --prefix services/core run seed:courses
    ```

This seeds 10 mechatronics engineering courses, mock assessment grades, and 9 profiles linked to institutional emails matching Technological University (Hmawbi).

---

## 4. Run Locally (Development Setup)

Ensure you have run `npm install` at the root folder to install dependencies. Then, run the unified orchestrator command to start all 5 services concurrently:

```bash
npm run start-all
```

*   **Vite Frontend:** `http://localhost:5173`
*   **API Gateway:** `http://localhost:5001`
*   **Services Health Checks:**
    *   Core Service: `http://localhost:5002/health`
    *   Attendance Service: `http://localhost:5003/health`
    *   AI Service: `http://localhost:5004/health`

---

## 5. Run With Docker (Containerized Setup)

Docker Compose builds all services and runs them on a single virtual network.

### 5.1 Local Developer Environment (Hot reload enabled)
```bash
docker compose up --build
```
*   **Frontend Client:** `http://localhost:5111`
*   **API Gateway:** `http://localhost:5001`

### 5.2 Production Reverse Proxy Setup (Nginx reverse proxy on Port 8050)
```bash
docker compose -f docker-compose.prod.yml up --build
```
*   **Nginx Client & Proxied API:** `http://localhost:8050`
*   *(In production mode, all service ports are kept internal and are only reachable via the frontend proxy).*

---

## 6. Pre-Defense Test Credentials

The database contains seeded test users. You can log in at the client login page using these credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **System Admin** | `admin@tuhmawbi.edu.mm` | `ChangeMeAdmin123!` |
| **Teacher (Daw Myat Thuzar)** | `myatthuzar@tuhmawbi.edu.mm` | `ChangeMeTeacher123!` |
| **Teacher (Lecturer)** | `teacher@tuhmawbi.edu.mm` | `ChangeMeTeacher123!` |
| **Student (Ye Yint Lin)** | `yeyintlin@tuhmawbi.edu.mm` | `ChangeMeStudent123!` |
| **Student (Jane Smith)** | `student@tuhmawbi.edu.mm` | `ChangeMeStudent123!` |
| **Student (Robert Chen)** | `robert@tuhmawbi.edu.mm` | `ChangeMeStudent123!` |
