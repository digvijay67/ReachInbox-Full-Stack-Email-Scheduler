# ReachInbox Scheduler

ReachInbox Scheduler is a full-stack email scheduling platform that allows users to authenticate with Google, compose emails, schedule them for delivery, and monitor sending status in a dashboard. The app uses a background worker queue to process email jobs reliably and supports search, Slack configuration, and per-sender rate limiting.

---

## Features

- Google OAuth login and session-based authentication
- Dashboard for scheduled and sent emails
- Compose and schedule email jobs for a future delivery time
- Email detail view with metadata and status tracking
- Background processing with BullMQ and Redis
- Per-sender hourly sending limits via Redis counters
- PostgreSQL persistence through Prisma ORM
- Elasticsearch-powered email search and filtering
- Slack integration settings and configuration support
- Docker Compose setup for local infrastructure services

---

## Architecture

ReachInbox follows a modular full-stack architecture with separate frontend, API, worker, and infrastructure layers.

```text
Frontend (React + Vite)
    │
    ├── User login and dashboard UI
    ├── Email compose and detail pages
    └── Calls backend API over HTTP
            │
            v
Backend (Express + TypeScript)
    ├── Auth routes for Google OAuth
    ├── Email routes for CRUD and scheduling
    ├── Slack routes for integration settings
    ├── Prisma access to PostgreSQL
    ├── Redis-backed rate limiting and queue metadata
    └── Elasticsearch indexing/search integration
            │
            v
Background Worker (BullMQ)
    ├── Consumes scheduled jobs from Redis
    ├── Sends emails with Nodemailer
    ├── Updates email status in PostgreSQL
    └── Maintains retry and processing flow
```

### Core services

- Frontend: React app for login, dashboard, compose flow, and email detail screens
- Backend API: Express server that handles authentication, scheduled email creation, search, and Slack settings
- Worker: background job processor for sending queued emails at their scheduled time
- Database: PostgreSQL via Prisma for persistent email and user records
- Queue: Redis + BullMQ for asynchronous email processing
- Search: Elasticsearch for fast email lookup
- Mailer: Nodemailer for outgoing email delivery

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd reachinbox-scheduler
```

### 2. Install dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. Start supporting infrastructure

This project uses PostgreSQL, Redis, and Elasticsearch via Docker Compose.

```bash
cd ..
docker compose up -d
```

The compose file exposes:

- PostgreSQL on port `5434`
- Redis on port `6380`
- Elasticsearch on port `9200`

### 4. Configure environment variables

Create a file at `backend/.env` with the following values:

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

- `SMTP_FROM` is the sender address shown in the UI and used for local testing.
- `MAX_EMAILS_PER_HOUR_PER_SENDER` enforces the hourly send cap per sender.
- Ethereal is used as a fake SMTP provider for development.

### 5. Prepare the database

Run Prisma generation and migrations:

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### 6. Run the app

From the project root:

```bash
npm run dev
```

This starts all services together:

- backend API
- BullMQ worker
- frontend development server

### 7. Access the app

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- BullMQ admin dashboard: http://localhost:5000/admin/queues

---

## Project Structure

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
├── docs/
│   └── screenshots/
├── docker-compose.yml
├── package.json
├── Readme.md
├── .gitignore
└── .env.example (if added later)
```

---

## Useful Commands

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

## Typical Workflow

1. Start the app with `npm run dev`
2. Log in using Google OAuth
3. Create a scheduled email from the dashboard
4. The backend stores the record and enqueues a BullMQ job
5. The worker sends the email when the scheduled time is reached
6. The email appears in the sent or failed list with status updates

---

## Deployment Notes

For production environments, update the following values to match your live public URLs:

- `FRONTEND_URL`
- `GOOGLE_CALLBACK_URL`
- CORS origin configuration in the backend
- Slack redirect URLs if Slack integration is enabled

---

## Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/Screenshot 2026-09-02 223924.png" alt="ReachInbox Google OAuth"></td>
    <td><img src="docs/screenshots/screenshot-222928.png" alt="ReachInbox login page"></td>
    <td><img src="docs/screenshots/screenshot-222730.png" alt="ReachInbox dashboard"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/screenshot-223004.png" alt="ReachInbox Slack settings"></td>
    <td><img src="docs/screenshots/screenshot-222826.png" alt="ReachInbox compose email page"></td>
    <td><img src="docs/screenshots/screenshot-223025.png" alt="ReachInbox scheduled email form"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/screenshot-223255.png" alt="ReachInbox email scheduling workflow"></td>
    <td><img src="docs/screenshots/screenshot-222747.png" alt="ReachInbox scheduled emails"></td>
    <td><img src="docs/screenshots/screenshot-222802.png" alt="ReachInbox email details"></td>
  </tr>
</table>

---

## Notes

- The app uses fake SMTP addresses during local development, so sender identity is configured from environment variables rather than the logged-in user email.
- The hourly limit is enforced per sender using Redis-backed counters.
- BullMQ jobs are durable in Redis, so queued work remains recoverable across worker restarts.
