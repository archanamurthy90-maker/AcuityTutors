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
- `npm test --workspace=server` runs the mastery scoring boundary tests.

## Seeded local demo accounts

The seed creates bcrypt-hashed local demo accounts. Tutor: `tutor@acuity.local` / `TutorDemo!2026`. Student accounts `ava@acuity.local`, `noah@acuity.local`, `mia@acuity.local`, `liam@acuity.local`, `zoe@acuity.local`, and `ethan@acuity.local` all use `StudentDemo!2026`. These are development-only fixture credentials.

## Authentication

Open `http://localhost:5173/login` and use a seeded account above. Students land on `/student`; tutors land on `/tutor`. Enter a seeded email with a wrong password to verify the form displays “Email or password is incorrect.” Use the “Create an account” link to test registration, choose a role, and submit a name, email, and password of at least 8 characters. Successful registration creates a bcrypt-hashed account and signs it in. Student and tutor pages show mastery data; students can record a correct/incorrect quiz result to see their score recalculate.

The API provides `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`. `GET /api/student/dashboard` and `GET /api/tutor/dashboard` require an authenticated session and enforce the matching role. Sessions use an eight-hour HttpOnly, SameSite=Strict JWT cookie. Passwords are hashed with bcrypt; login errors do not disclose whether an email exists.

## Gemini practice and tutor summaries

Set `GEMINI_API_KEY` in the ignored `server/.env`. Keep it there: never use a `VITE_` variable or send the key to the browser. The server uses Google's official `@google/genai` SDK and the stable `gemini-3.8-flash` model (current stable general model as of 2026-10-01) through the Interactions API. Requests use structured JSON output, a 30-second timeout, and `store: false`; responses are validated again on the server.

`POST /api/student/practice-questions` selects the signed-in student's weakest topic, asks Gemini for one original four-choice question at a matching difficulty, validates and saves it, and returns the question/options without the answer key. `POST /api/student/practice-questions/:questionId/answer` accepts one of those options, grades it on the server, records a `PRACTICE` QuizAttempt, and recalculates mastery in the same transaction. Question ownership is checked against the signed-in student. Needs Practice produces easy questions, Developing medium, Mastered hard; Not Enough Data uses easy until there is enough evidence.

`POST /api/tutor/students/:studentId/summary` creates a brief next-step summary only when the requested student belongs to the signed-in tutor's roster. The summary prompt prioritizes Needs Practice and Developing topics, and treats Not Enough Data as a reason to gather more evidence rather than a confirmed weakness.

**Prompt intent:** For practice, the system instruction establishes an encouraging, careful tutor; the task prompt requests an original middle-school question for the weakest subject/topic, with the mapped difficulty, four distinct choices, one matching correct answer, and a short teaching explanation. For summaries, the prompt asks for no more than three plain-English sentences, focusing first on weak topics, then developing topics, without recalculating or inventing scores. Student names and emails are not sent to Gemini.

**Browser test:** Sign in as `ava@acuity.local` and open `/student`. Select **Generate question**, choose one of the four options, and press **Check answer**. The correct answer and explanation appear only after submission, and the mastery row updates. Sign in as `tutor@acuity.local`, open `/tutor`, and select **Generate summary** on Ava's roster card. To test authorization, use a student session to request the tutor summary route for a student outside the roster; it returns 404. Without a session, the API returns 401. Provider timeouts, rate limits, configuration failures, and invalid model JSON return short friendly errors; raw provider messages and credentials are not sent to the browser.

## Mastery scoring

`server/src/services/mastery.ts` calculates topic accuracy as correct attempts divided by total attempts. Three or more attempts are classified as `MASTERED` at 80% or above, `DEVELOPING` at 60% or above, and `NEEDS_PRACTICE` below 60%. Fewer than three attempts are `NOT_ENOUGH_DATA`; accuracy is still reported when one or two attempts exist, and is `null` when there are no attempts. `MasteryScore` stores the accuracy, attempt count, and classification. The seed reads the persisted attempts back from PostgreSQL and uses this same service to recompute all student/topic snapshots.

For example, Ava Chen has 6 correct answers from 9 attempts on Expressions and Equations: 6 divided by 9 is 66.7%, so the topic is Developing. The current baseline seed has 398 attempts and 48 scores: 18 Mastered, 16 Developing, 13 Needs Practice, and 1 Not Enough Data. Each of the six students has examples of all three scored levels; attempt histories range from 2 to 12.

The protected routes are `GET /api/student/mastery` (only the signed-in student's scores), `GET /api/tutor/mastery` (scores for the signed-in tutor's linked roster), and `POST /api/student/attempts` (saves a quiz result and recalculates that student's topic score in the same database transaction). To test in the browser, sign in as `ava@acuity.local`, inspect the eight topic rows, choose a topic in “Log an attempt,” select Correct or Incorrect, and save; its accuracy, attempt count, and classification update immediately. Log out and sign in as `tutor@acuity.local` to see all six roster members and their 48 topic rows. A student session cannot access the tutor route, and a tutor session cannot access the student route.

## Data relationships

- Each `User` has one role and can own one `Student` or `Tutor` profile. Profiles keep learning and roster data separate from login credentials.
- Tutors and students connect through `TutorStudent`, so one tutor can have many students and a student can be shared with more than one tutor.
- A `Subject` contains `Topic` records. Quiz attempts, mastery scores, and practice questions each point to the topic they concern.
- Each `QuizAttempt` belongs to one student and one topic. Attempts are historical records and are not overwritten when new work is done. A practice attempt can optionally refer to its `PracticeQuestion`.
- Each `MasteryScore` is the current per-student/per-topic snapshot, unique for that pair and recomputable from the attempt history.
- Each `PracticeQuestion` belongs to a student and topic and stores its choices, answer, explanation, and difficulty for later review.

## Current scaffold boundary

This scaffold includes project structure, the initial relational schema, local database configuration, service health reporting, varied seeded demo history, JWT/bcrypt authentication, role-protected mastery views, transactional attempt logging with automatic score recomputation, deterministic mastery scoring, Gemini-generated saved practice questions with server-side grading, and roster-authorized tutor summaries. Roster management, broader quiz workflows, and Cloud deployment are not implemented or configured yet. Mastery must remain a deterministic calculation from append-only attempt history; generated AI content must not be treated as authoritative mastery data.
