# Campus Management System (MERN) - Docker Setup

This is my **Campus Management System** project (MERN stack). I am using **Docker + Docker Compose** so anyone can run the whole app (frontend + backend + database) without installing MongoDB locally.

## What's Inside

- Frontend: React (Vite build) served by Nginx on `http://localhost:5173`
- Backend: Node.js + Express API on `http://localhost:5000`
- Database: MongoDB (runs inside Docker, not exposed to the internet)

## Prerequisites

- Docker Desktop (includes Docker Compose)

## Folder Overview

- `docker-compose.yml` runs everything together
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

Stop containers:

```powershell
docker compose down
```

Reset everything (also deletes MongoDB data):

```powershell
docker compose down -v
```

## Ports and URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- MongoDB: not exposed on your host (Docker internal network only)

## Persistence

- MongoDB data is stored in a Docker volume: `mongo_data` -> `/data/db`
- File uploads are stored on the host: `./backend/uploads` is mounted to `/app/uploads`

## Common Troubleshooting

- Frontend cannot call the backend
  - Locally it is usually fine.
  - For real deployment, the frontend should not hardcode `localhost` (users are not running your backend on their own machine). A reverse proxy setup (Nginx) is the normal solution.

- MongoDB connection errors
  - Inside Docker, the backend must connect to `mongodb://mongo:27017/cms`.

## Security Notes

- Do not commit real secrets. Keep them in `backend/.env` (git ignores it).
- MongoDB is internal-only, but it currently has no username/password auth. Before real production deployment, enable MongoDB authentication.
