# Campus Management System (MERN) - Docker Setup

This is my **Campus Management System** project (MERN stack). I am using **Docker + Docker Compose** so anyone can run the whole app (frontend + backend + database) without installing MongoDB locally.

## What's Inside

- Frontend: React (Vite) and an Nginx production build
- Backend: Node.js + Express API (includes `GET /health` for healthchecks)
- Database: MongoDB (runs inside Docker, internal-only)

## Prerequisites

- Docker Desktop (includes Docker Compose)

## Folder Overview

- `docker-compose.dev.yml` is for development (hot reload)
- `docker-compose.prod.yml` is for production-like runs (Nginx reverse proxy on port 8050 by default)
- `docker-compose.yml` is a simple default compose file (prod-like behavior, but keeps the frontend mapped to port 5111 for convenience)
- `frontend/` is the React app
- `backend/` is the Express API

## Environment Setup

The backend uses a local env file at `backend/.env`. This file is ignored by git so secrets do not get committed.

1. Create your env file from the example:

```powershell
cd .
Copy-Item backend\.env.example backend\.env
```

2. Open `backend/.env` and update:

- `JWT_SECRET` to a long random string (important)

Notes:

- MongoDB is internal-only. The backend connects using `mongodb://mongo:27017/cms` (Docker service name `mongo`, not `localhost`).
- The frontend calls the backend using a relative `/api` path (so it works locally and when hosted). In dev/prod, `/api` is proxied to the backend.
- To use MongoDB Atlas, set `MONGODB_URI` in `backend/.env` to a `mongodb+srv://.../cms?...` URL (the part after the host is the database name).

## Run With Docker (Recommended)

Start everything (build included):

```powershell
cd .
docker compose up --build
```

Run in the background (optional):

```powershell
docker compose up --build -d
```

Check status and logs:

```powershell
docker compose ps
docker compose logs -f
```

### Dev vs Prod compose files

Dev (hot reload):

```powershell
docker compose -f docker-compose.dev.yml up --build
```

Prod-like (Nginx reverse proxy on port 8050):

```powershell
docker compose -f docker-compose.prod.yml up --build -d
```

Local testing on port 8050 in prod-like mode (optional):

```powershell
$env:FRONTEND_PORT=8050
docker compose -f docker-compose.prod.yml up --build -d
```

Stop containers:

```powershell
docker compose down
```

Reset everything (also deletes MongoDB data):

```powershell
docker compose down -v
```

## Seeding Default Users (Docker)

To seed `Admin`, `Teacher`, and `Student` users into the **Docker MongoDB** (`mongodb://mongo:27017/cms`):

```powershell
docker compose --profile seed up --build seed-users
```

For a thesis demo, reset the known demo passwords and verify the demo student profile:

```powershell
docker compose --profile demo up --build seed-demo
```

Local/Atlas equivalent:

```powershell
npm.cmd --prefix backend run seed:demo
```

To seed `Admin`, `Teacher`, and `Student` users into **MongoDB Atlas** (uses `MONGODB_URI` from `backend/.env`):

```powershell
docker compose --profile atlas-seed up --build seed-users-atlas
```

Notes:
- The seed container will exit after seeding (that is expected).
- `seed:users` preserves existing passwords unless `SEED_OVERWRITE_PASSWORDS=true` is set.
- `seed:demo` intentionally refreshes the demo passwords so the presentation logins stay reliable.

## Demo Accounts

Run `seed:demo` before your presentation to make these logins reliable:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@gmail.com` | `ChangeMeAdmin123!` |
| Teacher | `teacher@gmail.com` | `ChangeMeTeacher123!` |
| Student | `student@gmail.com` | `ChangeMeStudent123!` |

## Thesis Demo Walkthrough

Use this flow for a clean final-year project presentation:

1. Start the system and seed demo data:

```powershell
docker compose up --build -d
docker compose --profile demo up --build seed-demo
```

2. Open `http://localhost:5111` and log in as Admin: `admin@gmail.com` / `ChangeMeAdmin123!`.
3. Show the dashboard overview, then open Students and create or edit a student profile.
4. Open Teachers and create or edit a teacher account/profile.
5. Open Courses, Attendance, Grades, Exams, and Timetable to show the core academic management workflow.
6. Log in as Teacher to show staff-level access for academic records.
7. Log in as Student to show the student-facing dashboard, grades, exams, and timetable.
8. Finish with AI Assistant and AI Prompt Settings as the extra innovation layer for campus support.

## Reverse Proxy (Works Locally + Production)

The frontend uses a **relative** API path (`/api`). This is the key part that makes it work everywhere:

- Local dev (Vite): Vite proxies `/api` and `/uploads` to the backend.
- Production (Nginx): Nginx serves the frontend and proxies `/api` and `/uploads` to the backend container.

So your frontend never needs to call `http://localhost:5001` directly in production.

## Ports and URLs

- Dev (`docker-compose.dev.yml`): frontend `http://localhost:5111`, backend `http://localhost:5001`
- Default (`docker-compose.yml`): frontend `http://localhost:5111`, backend `http://localhost:5001`
- Prod-like (`docker-compose.prod.yml`): frontend `http://localhost:8050`, backend is internal-only (reachable via `http://localhost:8050/api/...` through Nginx)
- MongoDB: not exposed on your host (Docker internal network only)

## Persistence

- MongoDB data is stored in a Docker volume: `mongo_data` -> `/data/db`
- File uploads are stored on the host: `./backend/uploads` is mounted to `/app/uploads`

## Common Troubleshooting

- Frontend cannot call the backend
  - Locally it is usually fine.
  - For real deployment, the frontend should not hardcode `localhost` (users are not running your backend on their own machine). A reverse proxy setup (Nginx) is the normal solution.

- Backend looks "down" in prod-like mode
  - In `docker-compose.prod.yml` the backend does not publish port 5001 to your host. That is expected.
  - Test through the reverse proxy instead: `http://localhost:8050/api/...` or `http://localhost:8050/health`.

- MongoDB connection errors
  - Inside Docker, the backend must connect to `mongodb://mongo:27017/cms`.
  - `/health` starts responding as soon as the backend starts and includes a `database` field (`starting`, `connected`, `disconnected`, or `error`), so slow MongoDB startup is easier to diagnose.

- Dev proxy target in Docker
  - In `docker-compose.dev.yml`, Vite uses `VITE_DEV_PROXY_TARGET=http://backend:5001` so `/api` works inside the Docker network.

- Seed admin/teacher/student users
  - Set `MONGODB_URI` in `backend/.env` (local Mongo or Atlas).
  - Run: `npm.cmd --prefix backend run seed:users`
  - For a reliable thesis demo reset, run: `npm.cmd --prefix backend run seed:demo`
  - Default accounts: `admin@gmail.com`, `teacher@gmail.com`, `student@gmail.com` (passwords are in `backend/.env.example` seed section).

## Security Notes

- Do not commit real secrets. Keep them in `backend/.env` (git ignores it).
- MongoDB is internal-only, but it currently has no username/password auth. Before real production deployment, enable MongoDB authentication.
