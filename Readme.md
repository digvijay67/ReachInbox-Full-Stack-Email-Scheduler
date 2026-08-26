# ReachInbox – Full-Stack Email Scheduler
 
A production-oriented full-stack email scheduling system built as part of the ReachInbox hiring assignment.
 
The application allows authenticated users to upload email leads, compose emails, schedule them for a future time, and process them reliably using **BullMQ** and **Redis**.
 
---
 
## ✨ Features
 
- Persistent email scheduling (BullMQ delayed jobs — no cron)
- Redis-backed rate limiting (per-hour, per-sender)
- Configurable worker concurrency
- Minimum delay between emails
- Automatic rescheduling when hourly limits are reached
- Idempotent email processing (no duplicate sends)
- PostgreSQL persistence via Prisma ORM
- Ethereal SMTP integration (fake email for testing)
- Google OAuth authentication
- CSV/text lead upload with recipient count detection
- Scheduled and Sent email dashboards
- Restart-safe background processing
---
 
## 🏗 Project Structure
 
```
reachinbox-scheduler/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── generated/
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── redis.ts
│   │   │   └── mailer.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── queue/
│   │   │   └── email.queue.ts
│   │   ├── routes/
│   │   │   └── email.routes.ts
│   │   ├── workers/
│   │   │   └── email.worker.ts
│   │   └── server.ts
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   └── ...
│   ├── .env
│   ├── package.json
│   └── ...
│
├── docker-compose.yml
└── README.md
```
 
---
 
## 🧪 Technology Stack
 
**Backend:** Node.js, TypeScript, Express.js, Prisma ORM, PostgreSQL, Redis, BullMQ, Nodemailer, Ethereal Email, Google OAuth
 
**Frontend:** React, TypeScript, Tailwind CSS, Axios/Fetch API, CSV parsing, Google auth flow
 
**Infra:** PostgreSQL, Redis, Docker / Docker Compose, BullMQ Worker
 
---
 
## 🏛 High-Level Architecture
 
```text
                     ┌──────────────────────┐
                     │       Browser        │
                     │   React Frontend     │
                     └──────────┬───────────┘
                                │
                                │ HTTP API
                                ▼
                     ┌──────────────────────┐
                     │    Express Server    │
                     │     TypeScript       │
                     └──────────┬───────────┘
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
                 ▼              ▼              ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ PostgreSQL   │ │    Redis     │ │   Google     │
        │   Database   │ │              │ │    OAuth     │
        └──────────────┘ └──────┬───────┘ └──────────────┘
                                │
                                │ BullMQ
                                ▼
                     ┌──────────────────────┐
                     │    Email Worker      │
                     │  Configurable        │
                     │  Concurrency         │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │    Ethereal SMTP     │
                     │    Fake Email        │
                     └──────────────────────┘
```
 
### How scheduling works
When a user schedules a batch of emails, each recipient is written to PostgreSQL as an `Email` record with status `SCHEDULED`, and a corresponding BullMQ **delayed job** is enqueued in Redis with a `delay` computed from `scheduledTime - now`. No cron or polling loop is used — BullMQ's own delayed-job mechanism (backed by a Redis sorted set) wakes the worker at the correct time.
 
### How persistence on restart is handled
Because job state lives in Redis (BullMQ) and email state lives in PostgreSQL — not in process memory — restarting the API server or the worker does not lose any scheduled work. On boot, the worker simply re-attaches to the existing BullMQ queue; any delayed jobs that are already due are picked up immediately, and future jobs remain scheduled. Each job is keyed by a unique `jobId` (tied to the DB row's primary key) so a job already marked `SENT`/`FAILED` in Postgres will not be reprocessed — this is what guarantees idempotency across restarts.
 
### How rate limiting & concurrency are implemented
- **Concurrency:** the BullMQ `Worker` is created with a configurable `concurrency` option (`WORKER_CONCURRENCY` env var), controlling how many jobs run in parallel.
- **Delay between sends:** enforced via BullMQ's rate limiter (`limiter: { max, duration }`) so consecutive sends are spaced out (`MIN_DELAY_MS_BETWEEN_EMAILS`).
- **Hourly limits:** enforced using **Redis counters** keyed by `sender + hour_window` (e.g. `rate:{sender}:{YYYY-MM-DDTHH}`), incremented atomically (`INCR` + `EXPIRE`) so the check is safe across multiple worker instances — not just in-memory. When a sender's hourly cap (`MAX_EMAILS_PER_HOUR_PER_SENDER`) is hit, the job is **not failed or dropped** — it's rescheduled (re-enqueued with a new `delay`) into the next available hour window, preserving relative order.
---
 
## ⚙️ Environment Variables
 
### backend/.env
 
```env
# Server
PORT=4000
NODE_ENV=development
 
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox
 
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
 
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
 
# Session / JWT
SESSION_SECRET=change-me
JWT_SECRET=change-me
 
# Ethereal Email (SMTP)
ETHEREAL_USER=your-ethereal-username
ETHEREAL_PASS=your-ethereal-password
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
 
# Scheduler / Rate limiting
WORKER_CONCURRENCY=5
MIN_DELAY_MS_BETWEEN_EMAILS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
 
# Frontend origin (for CORS)
FRONTEND_URL=http://localhost:5173
```
 
### frontend/.env
 
```env
VITE_API_BASE_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```
 
> Get free Ethereal SMTP credentials at [ethereal.email](https://ethereal.email/) — click "Create Ethereal Account", copy the generated `user`/`pass` into `ETHEREAL_USER` / `ETHEREAL_PASS`. Sent emails can be previewed via the URL Nodemailer/Ethereal returns in the worker logs.
 
---
 
## 🚀 Running the Project
 
### Option A — Docker Compose (recommended for Postgres + Redis)
 
This spins up PostgreSQL and Redis only; the app itself is run locally for easier dev/debugging.
 
```bash
docker-compose up -d
```
 
Example `docker-compose.yml` services expected:
- `postgres` → exposed on `5432`
- `redis` → exposed on `6379`
### Option B — Manual (no Docker)
 
Install and run PostgreSQL and Redis locally, then update `DATABASE_URL` / `REDIS_HOST` / `REDIS_PORT` in `backend/.env` accordingly.
 
---
 
### 1. Backend Setup
 
```bash
cd backend
npm install
 
# Copy and fill in environment variables
cp .env.example .env   # or create .env manually as shown above
 
# Generate Prisma client & run migrations
npx prisma generate
npx prisma migrate dev --name init
 
# Start the API server
npm run dev
```
 
This starts the Express server (default: `http://localhost:4000`).
 
### 2. Start the Worker (separate process)
 
The BullMQ worker must run as its own process so it keeps consuming jobs independently of the API server.
 
```bash
cd backend
npm run worker
```
 
> If your `package.json` doesn't yet define a `worker` script, add:
> ```json
> "scripts": {
>   "dev": "ts-node-dev src/server.ts",
>   "worker": "ts-node-dev src/workers/email.worker.ts",
>   "build": "tsc",
>   "start": "node dist/server.js"
> }
> ```
 
### 3. Frontend Setup
 
```bash
cd frontend
npm install
npm run dev
```
 
This starts the React app (default: `http://localhost:5173`).
 
### 4. Verify
 
1. Open `http://localhost:5173`
2. Log in with Google
3. Go to the dashboard → click **Compose New Email**
4. Upload a CSV/text file of email addresses, fill subject/body, set start time, delay, and hourly limit
5. Click **Schedule**
6. Check the **Scheduled Emails** tab, then watch entries move to **Sent Emails** as the worker processes them
7. Test restart-safety: stop the worker (`Ctrl+C`), wait, restart it (`npm run worker`) — scheduled jobs still fire at their correct time, and no email is sent twice
---
 
## 🧰 Useful Commands
 
| Command | Location | Description |
|---|---|---|
| `npm run dev` | `backend/` | Start Express API in watch mode |
| `npm run worker` | `backend/` | Start BullMQ email worker |
| `npx prisma studio` | `backend/` | Browse the Postgres DB visually |
| `npx prisma migrate dev` | `backend/` | Apply schema migrations |
| `npm run dev` | `frontend/` | Start React dev server |
| `docker-compose up -d` | root | Start Postgres + Redis containers |
| `docker-compose down` | root | Stop containers |
 
---
 
## 📌 Assumptions, Shortcuts & Trade-offs
 
- Ethereal Email is used instead of a real SMTP provider, so "sent" emails are not delivered to real inboxes — they're viewable via Ethereal's preview URLs (logged by the worker).
- Rate limiting is enforced per-sender using Redis `INCR`/`EXPIRE` counters keyed by the hour window rather than a more complex sliding-window algorithm, favoring simplicity and correctness under concurrent workers.
- Job → DB row mapping uses the database primary key as the BullMQ `jobId`, which is what provides idempotency (BullMQ rejects duplicate job IDs on the same queue).
- CSV/text lead parsing happens client-side to give instant recipient-count feedback before scheduling.
---
 
## 🗺 Feature Mapping
 
**Backend:** scheduler (BullMQ delayed jobs) · persistence (Postgres + Prisma) · rate limiting (Redis counters, per-sender/hour) · concurrency (configurable BullMQ worker) · idempotency (jobId-based) · Google OAuth · Ethereal SMTP
 
**Frontend:** Google login · dashboard with user header/logout · Compose modal with CSV upload & recipient count · Scheduled Emails table (loading/empty states) · Sent Emails table (loading/empty states) · error handling/toasts