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

To seed `Admin`, `Teacher`, and `Student` users into **MongoDB Atlas** (uses `MONGODB_URI` from `backend/.env`):

```powershell
docker compose --profile atlas-seed up --build seed-users-atlas
```

Notes:
- The seed container will exit after seeding (that’s expected).
- To also overwrite existing seeded users’ passwords, set `SEED_OVERWRITE_PASSWORDS=true` when running compose.

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

- Dev proxy target in Docker
  - In `docker-compose.dev.yml`, Vite uses `VITE_DEV_PROXY_TARGET=http://backend:5001` so `/api` works inside the Docker network.

- Seed admin/teacher/student users
  - Set `MONGODB_URI` in `backend/.env` (local Mongo or Atlas).
  - Run: `npm.cmd --prefix backend run seed:users`
  - Default accounts: `admin@gmail.com`, `teacher@gmail.com`, `student@gmail.com` (passwords are in `backend/.env.example` seed section).

## Security Notes

- Do not commit real secrets. Keep them in `backend/.env` (git ignores it).
- MongoDB is internal-only, but it currently has no username/password auth. Before real production deployment, enable MongoDB authentication.
