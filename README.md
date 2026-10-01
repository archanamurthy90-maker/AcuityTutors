# Acuity Tutors

A full-stack tutoring-center application foundation for focused practice and durable student progress tracking.

## Stack

- React 19 + Vite + TypeScript (`client/`)
- Node.js + Express + TypeScript (`server/`)
- PostgreSQL + Prisma (`prisma/`)
- Local development uses a native PostgreSQL installation; Docker Compose is an optional alternative.
- Gemini is reserved for server-side question generation and tutor summaries; no Gemini integration is implemented yet.

## Prerequisites

- Node.js 20.19+ (Node 22+ recommended)
- npm 10+
- PostgreSQL 16+ running on `localhost:5432` (Windows installer or optional Docker Compose)

## Local development with PostgreSQL on Windows

From the repository root in PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

Open `server/.env` and replace `YOUR_PASSWORD` on line 3 with the password for the PostgreSQL `postgres` user. If the password contains URL-reserved characters, percent-encode them in the connection URL. Do not commit `server/.env` or put this password in a `VITE_` variable.

Install dependencies and create the application database once:

```powershell
npm install
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -h localhost -p 5432 -d postgres -c "CREATE DATABASE acuity_tutors;"
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

If `psql` is on PATH, the full executable path can be replaced with `psql`. Update the path above if a different PostgreSQL major version was installed. The API and Prisma commands load their settings from `server/.env`.

Open the Vite client at `http://localhost:5173`; the Express API is at `http://localhost:3001`, and `GET /api/health` checks the live database connection as well as configuration.

## Optional Docker Compose database

Docker Desktop is not required for native PostgreSQL. To use the optional container instead, run `docker compose up -d db`, then change the `DATABASE_URL` in `server/.env` to:

```text
postgresql://acuity:acuity_local_dev@localhost:5432/acuity_tutors?schema=public
```

Stop the container with `docker compose down`. Persistent container data is stored in the `acuity_postgres_data` volume. To remove that data as well, explicitly run `docker compose down -v`.

## Commands

- `npm run dev` starts the Vite client and Express API.
- `npm run build` type-checks and builds both workspaces.
- `npm start` serves the production client build and API from Express (build the client first).
- `npm run db:generate` generates the Prisma client using `server/.env`.
- `npm run db:migrate -- --name <migration-name>` creates/applies a development migration.
- `npm run db:deploy` applies committed migrations in a deployment environment.
- `npm run db:seed` creates or refreshes the local demo tutor, students, topics, quiz history, and mastery snapshots.
- `npm run db:studio` opens Prisma Studio.

## Seeded local demo accounts

The seed creates bcrypt-hashed local demo accounts. Tutor: `tutor@acuity.local` / `TutorDemo!2026`. Student accounts `ava@acuity.local`, `noah@acuity.local`, `mia@acuity.local`, `liam@acuity.local`, `zoe@acuity.local`, and `ethan@acuity.local` all use `StudentDemo!2026`. These are development-only fixture credentials.

## Authentication

Open `http://localhost:5173/login` and use a seeded account above. Students land on `/student`; tutors land on `/tutor`. Enter a seeded email with a wrong password to verify the form displays “Email or password is incorrect.” Use the “Create an account” link to test registration, choose a role, and submit a name, email, and password of at least 8 characters. Successful registration creates a bcrypt-hashed account and signs it in. The current student and tutor workspaces are placeholders.

The API provides `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`. `GET /api/student/dashboard` and `GET /api/tutor/dashboard` require an authenticated session and enforce the matching role. Sessions use an eight-hour HttpOnly, SameSite=Strict JWT cookie. Passwords are hashed with bcrypt; login errors do not disclose whether an email exists.

## Data relationships

- Each `User` has one role and can own one `Student` or `Tutor` profile. Profiles keep learning and roster data separate from login credentials.
- Tutors and students connect through `TutorStudent`, so one tutor can have many students and a student can be shared with more than one tutor.
- A `Subject` contains `Topic` records. Quiz attempts, mastery scores, and practice questions each point to the topic they concern.
- Each `QuizAttempt` belongs to one student and one topic. Attempts are historical records and are not overwritten when new work is done. A practice attempt can optionally refer to its `PracticeQuestion`.
- Each `MasteryScore` is the current per-student/per-topic snapshot, unique for that pair and recomputable from the attempt history.
- Each `PracticeQuestion` belongs to a student and topic and stores its choices, answer, explanation, and difficulty for later review.

## Current scaffold boundary

This scaffold includes project structure, the initial relational schema, local database configuration, service health reporting, seeded demo history, and JWT/bcrypt authentication with role-protected workspace placeholders. Tutor roster views, attempt logging workflows, mastery calculation services, Gemini integration, and Cloud deployment are not implemented or configured yet. Mastery must remain a deterministic calculation from append-only attempt history; generated AI content must not be treated as authoritative mastery data.
