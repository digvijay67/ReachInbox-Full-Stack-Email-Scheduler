# ReachInbox Scheduler

ReachInbox is a full-stack email scheduling application built with React, Express, Prisma, PostgreSQL, Redis, and BullMQ. It lets authenticated users compose messages, schedule them for the future, and process them reliably in the background.

This project is designed for local development and deployment-friendly startup, with one root command to launch the API, worker, and frontend together.

---

## Features

- Google OAuth login
- Dashboard for scheduled and sent emails
- Email detail page with metadata and delete support
- SMTP sender display from configured environment values
- Background email processing with BullMQ worker
- Redis-backed per-sender hourly limit
- PostgreSQL persistence with Prisma
- Elastic search integration for email search
- Slack integration support
- Docker Compose support for PostgreSQL, Redis, and Elasticsearch

---

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Queue: BullMQ + Redis
- Search: Elasticsearch
- Auth: Google OAuth + Express Session
- Mail: Nodemailer with Ethereal SMTP for testing

---

## Project structure

```text
reachinbox-scheduler/
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── package.json
├── Readme.md
└── .gitignore
```

---

## One-command startup

From the root folder, run:

```bash
npm run dev
```

This starts all three services together:

- backend API
- BullMQ worker
- frontend app

The root package scripts are:

```json
{
  "scripts": {
    "dev": "concurrently -n backend,worker,frontend -c blue,magenta,green \"npm --prefix backend run dev\" \"npm --prefix backend run worker\" \"npm --prefix frontend run dev -- --host 0.0.0.0\"",
    "build": "npm --prefix backend run build && npm --prefix frontend run build",
    "start": "concurrently -n backend,worker -c blue,magenta \"npm --prefix backend run start\" \"npm --prefix backend run worker\"",
    "preview": "npm run build && concurrently -n backend,worker,frontend -c blue,magenta,green \"npm --prefix backend run start\" \"npm --prefix backend run worker\" \"npm --prefix frontend run preview -- --host 0.0.0.0\""
  }
}
```

---

## Backend environment

Create or update [backend/.env](backend/.env) with values like:

```env
PORT=5000
NODE_ENV=development

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

SESSION_SECRET=change-me

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user
SMTP_PASS=your-ethereal-pass
SMTP_FROM=your-fake-sender@example.com

WORKER_CONCURRENCY=5
MIN_DELAY_MS_BETWEEN_EMAILS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200

FRONTEND_URL=http://localhost:5173
```

Notes:

- `SMTP_FROM` is used to display the sender email on the email detail screen.
- `MAX_EMAILS_PER_HOUR_PER_SENDER` is the hourly sending cap per sender.
- Ethereal is used for fake email testing during development.

---

## Docker setup

From the repo root:

```bash
docker compose up -d
```

The compose file includes:

- PostgreSQL
- Redis
- Elasticsearch

---

## Local setup

### 1. Install dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start database and services

```bash
docker compose up -d
```

### 3. Run the full app

```bash
cd ..
npm run dev
```

### 4. Build for production

```bash
npm run build
```

---

## Database and Prisma

If Prisma migrations are needed:

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

---

## Deployment notes

For deployed environments, update the following values to match your live public URLs:

- `FRONTEND_URL`
- `GOOGLE_CALLBACK_URL`
- CORS origin in the backend server config
- Slack redirect URLs if using Slack integration

The app is ready for deployment-friendly startup with the root-level scripts, but production values should be configured in the environment for the hosting platform you use.

---

## Typical workflow

1. Start the app with `npm run dev`
2. Log in with Google
3. Create a scheduled email from the dashboard
4. The backend stores the record and enqueues a BullMQ job
5. The worker sends the email after the scheduled time
6. The email appears in the sent or failed list accordingly

---

## Useful commands

```bash
# root
npm run dev
npm run build
npm run start

# backend
cd backend
npm run dev
npm run worker
npm run build

# frontend
cd frontend
npm run dev
npm run build
```

---

## Notes

- The app uses fake SMTP addresses during local development, so sender identity is intentionally configured via environment variables rather than the logged-in user email.
- The hourly limit is enforced per sender using Redis-backed counters.
- The queue is restart-safe because BullMQ persists scheduled jobs in Redis and worker state is reattached on startup.
