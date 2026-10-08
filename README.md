# Acuity Tutors

A full-stack tutoring-center application foundation for focused practice and durable student progress tracking.

## Stack

- React 19 + Vite + TypeScript (`client/`)
- Node.js + Express + TypeScript (`server/`)
- PostgreSQL + Prisma (`prisma/`)
- Local development uses a native PostgreSQL installation; Docker Compose is an optional alternative.
- Gemini 3.8 Flash through the server-only Interactions API for adaptive practice questions and tutor summaries.

## Prerequisites

- Node.js 20.19+ (Node 22+ recommended)
- npm 10+
- PostgreSQL 16+ running on `localhost:5432` (Windows installer or optional Docker Compose)

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `server/.env` / Cloud Run secret | Prisma PostgreSQL connection string. |
| `JWT_SECRET` | `server/.env` / Secret Manager | JWT signing secret; use a random value of at least 32 characters. |
| `GEMINI_API_KEY` | `server/.env` / Secret Manager | Server-only Gemini API credential. Never prefix it with `VITE_`. |
| `PORT` | `server/.env` / Cloud Run runtime | Express listen port; defaults to `3001` locally. Cloud Run supplies this automatically. |
| `NODE_ENV` | process environment | Set to `production` in deployment to enable secure cookies, static frontend serving, `trust proxy`, the minimal health response, and redacted error logs. |
| `CLIENT_ORIGIN` | `server/.env` / Cloud Run env | Comma-separated CORS allowlist for browser origins; defaults to `http://localhost:5173`. Same-host requests are always allowed. |
| `ALLOW_DEMO_SEED` | process environment | Set to `true` only to run the demo seed against a disposable database while `NODE_ENV=production`; the seed refuses otherwise. |
| `VITE_API_BASE_URL` | `client/.env` | Browser API base; defaults to same-origin `/api`. Safe for client exposure. |
| `VITE_API_PROXY_TARGET` | Vite process environment | Optional development proxy target; defaults to `http://localhost:3001`. |
| `POSTGRES_PASSWORD` | root `.env`, Docker only | Optional Compose database password; Compose defaults to `acuity_local_dev` for local use. |

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

Open the Vite client at `http://localhost:5173`; the Express API is at `http://localhost:3001`, and in local development `GET /api/health` checks the live database connection as well as configuration (in production it returns only `{"status":"ok"}`).

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
- `npm test` runs the server and client test suites.
- `npm test --workspace=server` runs auth, error-handling, mastery, progress-series, and Gemini response/error tests.
- `npm test --workspace=client` runs Vitest (jsdom) tests for session expiry handling, the error boundary, registration, sign-in page copy, accessibility (axe-core, keyboard focus, form errors, chart text alternative), and colour contrast.
- `npm run test:api --workspace=server` runs the API-level cases from `docs/TEST_CHECKLIST.md` against a running API (`API_URL` defaults to `http://localhost:3001`; `SKIP_GEMINI=1` skips Gemini calls). It creates and deletes temporary accounts and records practice answers for Ava, so run `npm run db:seed` afterwards to restore the baseline.
- `npm run lint` runs oxlint on the client.

## Seeded local demo accounts

The seed creates bcrypt-hashed local demo accounts. Tutor: `tutor@acuity.local` / `TutorDemo!2026`. Student accounts `ava@acuity.local`, `noah@acuity.local`, `mia@acuity.local`, `liam@acuity.local`, `zoe@acuity.local`, and `ethan@acuity.local` all use `StudentDemo!2026`. These are development-only fixture credentials.

## Authentication

Open `http://localhost:5173/login` and use a seeded account above. Students land on `/student`; tutors land on `/tutor`. Enter a seeded email with a wrong password to verify the form displays “Email or password is incorrect.” Use the “Create an account” link to test registration: public registration creates **student accounts only** (the API returns 403 for any other role; tutors come from the seed script). Submit a name, email, and password with at least 8 characters (at most 72), one letter, and one number. The register form shows this rule under the password field and blocks weak values; the server enforces the same rule and returns HTTP 400 if bypassed. Login behavior is unchanged. Successful registration creates a bcrypt-hashed account and signs it in. Student and tutor pages show mastery data; students can record a correct/incorrect quiz result to see their score recalculate.

The API provides `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`. `GET /api/student/dashboard` and `GET /api/tutor/dashboard` require an authenticated session and enforce the matching role. Sessions use an eight-hour HttpOnly, SameSite=Strict JWT cookie whose claims are only the user ID and role. Passwords are hashed with bcrypt; login errors do not disclose whether an email exists. An expired session token returns 401 with code `SESSION_EXPIRED` and the message “Your session has expired, please sign in again.”; any 401 from a protected request signs the browser out and shows that message on the sign-in page.

**Accessibility (WCAG 2.1 AA basics):** Every page starts with a "Skip to main content" link and shows a high-contrast focus outline on every control. Form errors are linked to their fields and announced, and loading and progress changes are announced through a status region. Focus moves to a new practice question and then to its feedback. The accuracy chart has a text summary and a screen-reader data table, and text meets 4.5:1 contrast. `client/tests/a11y.test.tsx` runs axe-core against each page, and `client/tests/contrast.test.ts` checks the colour tokens. See `docs/TEST_CHECKLIST.md` (AX1–AX16) for manual keyboard, screen-reader, zoom, and Lighthouse checks.

**Security controls:** See `docs/SECURITY_AUDIT.md` and `docs/SECURITY_CHECKLIST.md`. helmet sets a strict Content-Security-Policy (`'self'` only, no inline scripts or styles), `X-Frame-Options: DENY`, HSTS, and `nosniff`. CORS allows only `CLIENT_ORIGIN` (or the same host), and cross-origin writes are rejected with 403. Rate limits return 429 with a friendly message: sign-in (10 failed attempts per IP and email, 100 per IP, per 15 minutes; successful sign-ins don't count), registration (20 accounts per IP per hour), practice questions (20 per student per 10 minutes), and tutor summaries (30 per tutor per 10 minutes). Counters are in memory per server instance; use a shared store before running several instances. JSON bodies are limited to 100 KB. The demo seed refuses to run with `NODE_ENV=production`.

**Error handling:** Malformed JSON request bodies return 400 with a clear message. Database connection failures return 503 with a friendly message; details are logged on the server only. Other unexpected errors return a generic 500. If the React UI crashes while rendering, an error boundary shows a friendly fallback page with a reload button instead of a blank screen.

## Gemini practice and tutor summaries

Set `GEMINI_API_KEY` in the ignored `server/.env`. Keep it there: never use a `VITE_` variable or send the key to the browser. The server uses Google's official `@google/genai` SDK and the stable `gemini-3.8-flash` model (current stable general model as of 2026-10-01) through the Interactions API. Requests use structured JSON output, a 30-second timeout, and `store: false`; responses are validated again on the server.

`POST /api/student/practice-questions` selects the signed-in student's weakest topic, asks Gemini for one original four-choice question at a matching difficulty, validates and saves it, and returns the question/options without the answer key. `POST /api/student/practice-questions/:questionId/answer` accepts one of those options, grades it on the server, records a `PRACTICE` QuizAttempt, and recalculates mastery in the same transaction. Question ownership is checked against the signed-in student. Each question can be answered once: a unique database constraint on `QuizAttempt.practiceQuestionId` blocks duplicates, and a second or simultaneous answer returns 409 “This question has already been answered.” Needs Practice produces easy questions, Developing medium, Mastered hard; Not Enough Data uses easy until there is enough evidence.

`POST /api/tutor/students/:studentId/summary` creates a brief next-step summary only when the requested student belongs to the signed-in tutor's roster. The summary prompt prioritizes Needs Practice and Developing topics, and treats Not Enough Data as a reason to gather more evidence rather than a confirmed weakness.

**Responsible AI:** See `docs/RESPONSIBLE_AI.md`. Every AI question, explanation, and tutor summary carries an "AI-generated — may contain mistakes" label. The student dashboard explains how mastery is calculated (correct ÷ total; a fixed rule, not AI). Tutor summaries are worded as suggestions, and the tutor makes the final decision. Students can **Report this question** (`POST /api/student/practice-questions/:questionId/report`, optional reason ≤300 characters, own questions only, once per question); tutors see their roster's reports under "Reported AI questions" (`GET /api/tutor/question-reports`). The Gemini system instruction requires age-appropriate, on-topic, unbiased content and to ignore instructions inside the `<topic_data>` block; output with links, emails, or markup is rejected with a safe fallback.

**Prompt intent:** For practice, the system instruction establishes an encouraging, careful tutor; the task prompt requests an original middle-school question for the weakest subject/topic, with the mapped difficulty, four distinct choices, one matching correct answer, and a short teaching explanation. For summaries, the prompt asks for no more than three plain-English sentences, focusing first on weak topics, then developing topics, without recalculating or inventing scores. Student names and emails are not sent to Gemini.

**Browser test:** Sign in as `ava@acuity.local` and open `/student`. Select **Generate question**, choose one of the four options, and press **Check answer**. The correct answer and explanation appear only after submission, and the mastery row updates. Sign in as `tutor@acuity.local`, open `/tutor`, and select **Generate summary** on Ava's roster card. To test authorization, use a student session to request the tutor summary route for a student outside the roster; it returns 404. Without a session, the API returns 401. Provider timeouts, rate limits, configuration failures, and invalid model JSON return short friendly errors; raw provider messages and credentials are not sent to the browser.

## Mastery scoring

`server/src/services/mastery.ts` calculates topic accuracy as correct attempts divided by total attempts. Three or more attempts are classified as `MASTERED` at 80% or above, `DEVELOPING` at 60% or above, and `NEEDS_PRACTICE` below 60%. Fewer than three attempts are `NOT_ENOUGH_DATA`; accuracy is still reported when one or two attempts exist, and is `null` when there are no attempts. `MasteryScore` stores the accuracy, attempt count, and classification. The seed reads the persisted attempts back from PostgreSQL and uses this same service to recompute all student/topic snapshots.

For example, Ava Chen has 6 correct answers from 9 attempts on Expressions and Equations: 6 divided by 9 is 66.7%, so the topic is Developing. The current baseline seed has 398 attempts and 48 scores: 18 Mastered, 16 Developing, 13 Needs Practice, and 1 Not Enough Data. Each of the six students has examples of all three scored levels; attempt histories range from 2 to 12.

The protected routes are `GET /api/student/mastery` (only the signed-in student's scores), `GET /api/tutor/mastery` (scores for the signed-in tutor's linked roster), and `POST /api/student/attempts` (saves a quiz result and recalculates that student's topic score in the same database transaction). To test in the browser, sign in as `ava@acuity.local`, inspect the eight topic rows, choose a topic in “Log an attempt,” select Correct or Incorrect, and save; its accuracy, attempt count, and classification update immediately. Log out and sign in as `tutor@acuity.local` to see all six roster members and their 48 topic rows. A student session cannot access the tutor route, and a tutor session cannot access the student route.

The student page groups mastery by subject, shows mastered/needs-practice counts and the weakest topic, and graphs cumulative accuracy after each attempt. `GET /api/student/progress` returns only the signed-in student's attempt histories. The tutor page ranks class-wide topics by numbers of students needing practice/developing, shows a weighted overall mastery level and weak topics per student, and expands a selected student's subject-grouped breakdown and accuracy chart. `GET /api/tutor/students/:studentId/progress` is restricted to students linked to that tutor.

**Dashboard browser test:** Sign in as `ava@acuity.local` / `StudentDemo!2026` to see subject groups, the weakest-topic cue, accuracy chart, and existing AI practice flow. In another session, sign in as `tutor@acuity.local` / `TutorDemo!2026`; compare the class-wide topic ranking, select Ava Chen to expand her complete breakdown/progress chart, and use her existing **Generate summary** action. A student with no attempts sees empty guidance instead of an empty chart, and practice generation remains disabled until topics exist. At phone width, tables scroll within their own region; the page itself does not overflow horizontally.

## Data relationships

- Each `User` has one role and can own one `Student` or `Tutor` profile. Profiles keep learning and roster data separate from login credentials.
- Tutors and students connect through `TutorStudent`, so one tutor can have many students and a student can be shared with more than one tutor.
- A `Subject` contains `Topic` records. Quiz attempts, mastery scores, and practice questions each point to the topic they concern.
- Each `QuizAttempt` belongs to one student and one topic. Attempts are historical records and are not overwritten when new work is done. A practice attempt can optionally refer to its `PracticeQuestion`.
- Each `MasteryScore` is the current per-student/per-topic snapshot, unique for that pair and recomputable from the attempt history.
- Each `PracticeQuestion` belongs to a student and topic and stores its choices, answer, explanation, and difficulty for later review.

## Cloud Run and Cloud SQL deployment

**Live:** https://acuity-tutors-1045685760887.us-east1.run.app. Deployed and verified on 2026-10-07: health check, sign-in page, and student and tutor sign-in. The steps and every error are logged in `docs/DEV_LOG.md` under "Assignment 6.2". Cloud SQL does not scale to zero (about $10–13 per month), so keep the budget alert, and stop the instance when the demo is not needed.

| Resource | Name and settings |
|---|---|
| Region | `us-east1` |
| Cloud SQL | `acuity-tutors-db`: PostgreSQL 17, Enterprise edition, `db-f1-micro`, 10 GB SSD, zonal, daily backups (7 kept), public IP with no authorized networks (reachable only through the Cloud SQL connector). Database `acuity_tutors`, user `acuity_app`. |
| Secret Manager | `acuity-database-url` (Unix-socket URL with `connection_limit=5`), `acuity-jwt-secret`, `acuity-gemini-api-key` |
| Runtime service account | `acuity-run-sa`: `roles/cloudsql.client` plus Secret Accessor on those three secrets only |
| Cloud Run service | `acuity-tutors`: built from source with Google Cloud buildpacks (root `build`, then `start`); `NODE_ENV=production`; `CLIENT_ORIGIN` set to both run.app URL forms; Cloud SQL attached; 512 MiB, 1 CPU, 0–1 instances; public access (the app enforces its own sign-in) |
| Cloud Run Job | `acuity-migrate`: runs `prisma migrate deploy` from the service image. Rerun it after deploying a change that adds migrations: `gcloud run jobs execute acuity-migrate --region us-east1 --wait`. |

Demo data was loaded once by a temporary job (`acuity-seed`) with `ALLOW_DEMO_SEED=true`, and the job was then deleted; the live service never has that setting. The demo passwords in this README are public, so treat this database as a disposable demo.

**Running a command inside the deployed image:** jobs built from the buildpack image use `--command /cnb/lifecycle/launcher`, with the command as `--args`, for example `node,node_modules/prisma/build/index.js,migrate,deploy,--schema,prisma/schema.prisma`.

**Manual redeploy from Cloud Shell:**

```bash
gcloud run deploy acuity-tutors --source . --region us-east1
```

Existing settings (secrets, Cloud SQL, service account, environment variables, scaling) are kept unless flags change them.

## Current scaffold boundary

The app includes authentication, student/tutor mastery dashboards with accuracy history, transactional attempt scoring, Gemini-generated saved practice questions with server-side grading, and roster-authorized tutor summaries. Roster enrollment management and broader quiz workflows are not implemented yet. Mastery must remain a deterministic calculation from append-only attempt history; generated AI content must not be treated as authoritative mastery data.
