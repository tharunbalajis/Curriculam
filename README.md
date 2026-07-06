# CurriSync

Curriculum management system with a 3-layer role hierarchy (top admin / department
sub-admin / faculty) and an email-driven task assignment + approval workflow.

- **Backend**: Node.js + Fastify + Prisma (Neon Postgres) + nodemailer
- **Frontend**: React (Vite) + Tailwind CSS

## Prerequisites

You need a Neon Postgres database with the `schema.sql` in this repo already
run against it (tables + the six seed departments). Prisma is only ever
pointed at that existing schema via `db pull` — it never creates or drops
tables.

## Environment variables to fill in before step 1

`backend/.env` (copy from `backend/.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Your Neon connection string |
| `JWT_SECRET` | Yes | Any long random string |
| `FRONTEND_URL` | Yes | `http://localhost:5173` for local dev |
| `PORT` | No | Defaults to `5000` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | No | If omitted, emails are skipped with a console warning — the workflow still runs end to end, you'll just need to copy links (task/review) from the server logs or database instead of email |

`frontend/.env` (copy from `frontend/.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5000/api` for local dev |

## Setup commands, in order

```bash
# 1. Install backend dependencies
cd backend
npm install

# fill in backend/.env now (copy from .env.example)

# 2. Point Prisma at your existing Neon tables
npx prisma db pull
npx prisma generate

# 3. Seed accounts + sample courses (idempotent — safe to re-run)
node seed.js

# 4. Install frontend dependencies
cd ../frontend
npm install

# fill in frontend/.env now (copy from .env.example)

# 5. Start the backend (from backend/)
cd ../backend
npm run dev

# 6. Start the frontend dev server (from frontend/, in a second terminal)
cd ../frontend
npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:5173`.

## Logging in

Run `node seed.js` and read the printed table for every generated email +
password (1 top admin, 1 sub-admin and 2 faculty per department). Faculty
accounts don't use the login screen — they receive task links by email (or,
if SMTP isn't configured, see the `[email] SMTP not configured` log line and
the task's `access_token` column for the `/task/:token` link).

## Project structure

```
currisync/
├── backend/        Fastify API, Prisma schema, seed script
└── frontend/        React (Vite) + Tailwind SPA
```

See `backend/src/app.js` for the full list of registered routes and
`backend/prisma/schema.prisma` for the data model (mirrors the existing
Neon tables — model/field names match the raw SQL columns verbatim).
