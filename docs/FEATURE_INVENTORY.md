# Feature Inventory — Acuity Tutors

Every page, button, form, API endpoint, and user workflow in the app as of commit `b09e195` (2026-10-04). Each feature has an ID; [TEST_CHECKLIST.md](TEST_CHECKLIST.md) references these IDs in its **Feature** column so coverage can be traced.

**Pages (client routes):** `/login`, `/register`, `/student`, `/tutor`. `/` and any unknown path redirect to the signed-in user's dashboard, or to `/login` when signed out. Every page is wrapped in the error boundary (UI-1).

---

## Authentication

| ID | Feature | Where | Details |
|---|---|---|---|
| AUTH-1 | Sign-in page | `/login` | **Form:** Email address, Password. **Button:** "Sign in" (shows "Please wait…" and is disabled while submitting). **Link:** "Create an account" → `/register`. Client checks email format before sending; server errors appear in an alert box. A wrong email or password shows the same generic "Email or password is incorrect." |
| AUTH-2 | Registration page | `/register` | **Form:** Full name (2–80 chars), "I am joining as" toggle **buttons** Student / Tutor, Email address, Password with the hint "At least 8 characters, including a letter and a number." **Button:** "Create account". **Link:** "Sign in" → `/login`. A duplicate email returns "An account with this email already exists." On success the user is signed in and sent to their dashboard. |
| AUTH-3 | Password policy and hashing | Client + `POST /api/auth/register` | 8–128 characters with at least one letter and one number, enforced on both client and server (R3 fix). Passwords are hashed with bcrypt (cost 12) and never returned. |
| AUTH-4 | Role-based redirects | Client router | After sign-in or registration: students go to `/student`, tutors to `/tutor`. `/` and unknown paths redirect by role, or to `/login` when signed out. |
| AUTH-5 | Client route guards | `/student`, `/tutor` | A signed-out visitor is sent to `/login`. A user who opens the other role's page is sent back to their own dashboard. |
| AUTH-6 | Session cookie | Server | An 8-hour HS256 JWT in the `acuity_session` cookie: HttpOnly, SameSite=Strict, Secure in production. The issuer and audience are checked. Refreshing the page keeps the session (via `GET /api/auth/me`). |
| AUTH-7 | Logout | "Log out" button in both dashboard headers | Calls `POST /api/auth/logout`, clears the cookie, and returns to `/login`. The button reads "Signing out…" while working. |
| AUTH-8 | Session-expired behavior (BUG-01, BUG-02) | Server `requireAuth` + client `apiFetch` | The server returns 401 with code `SESSION_EXPIRED` ("Your session has expired, please sign in again."), `SESSION_INVALID`, or `AUTH_REQUIRED`, and clears the cookie for an expired or invalid token. On page load, a `SESSION_EXPIRED` response from `/auth/me` shows that message on the sign-in page. While signed in, **any** 401 from a protected request signs the user out and shows the same message. Login, register, and logout do not trigger this, so a wrong password is not mistaken for an expired session. |
| AUTH-9 | Server role and ownership enforcement | All protected routes | `requireAuth` + `requireRole` return 401 or 403. Students can access only their own data. A tutor can access only students linked through `TutorStudent`; any other student returns 404. URL IDs must be valid CUIDs, otherwise the server returns 400. |
| AUTH-10 | Auth API | `/api/auth/*` | `POST /register` (201, 400 validation, 409 duplicate, 503 if `JWT_SECRET` is missing). `POST /login` (200, 400, 401). `POST /logout` (204). `GET /me` (200 user, or 401 with a code). |

## Student

| ID | Feature | Where | Details |
|---|---|---|---|
| STU-1 | Student dashboard shell | `/student` | Header with the student's name, a STUDENT label, and the "Log out" button. The intro message comes from `GET /api/student/dashboard`. Shows a "Loading mastery data…" state and an error alert if loading fails. |
| STU-2 | Mastery summary band | `/student` | "N topics mastered, N need practice · N developing", or an empty-state message when there are no attempts. |
| STU-3 | Mastery by subject | `/student` "Your mastery" | Topic tables grouped by subject, showing accuracy, attempt count, and a colour-coded status (Mastered / Developing / Needs Practice / Not enough data), plus a topic count. Shows an empty-state message when there are no scores. |
| STU-4 | Accuracy-over-time chart | `/student` "Accuracy over time" | A **Topic select** dropdown and a line chart of running accuracy after each attempt (Recharts, lazy-loaded). Has loading, error, and empty states. Data comes from `GET /api/student/progress`. |
| STU-5 | Weakest-topic cue | `/student` practice panel | A "TOP PRIORITY" card naming the weakest topic. Order: Needs Practice, then Developing, then Not enough data, then Mastered, with ties broken by lowest accuracy. |
| STU-6 | Log an attempt form | `/student` "Log an attempt" | **Form:** Topic select (the student's topics); Result toggle **buttons** "Correct" / "Incorrect" (`aria-pressed`); **Button:** "Save attempt" ("Saving…" and disabled while saving; disabled when there are no topics). On success it shows "Saved. {status} after N attempts." and updates that topic's row. Calls `POST /api/student/attempts`. |
| STU-7 | Student API | `/api/student/*` | `GET /dashboard`, `GET /mastery` (own scores), `GET /progress` (own attempt history series), `POST /attempts` (body: `topicId` CUID, `isCorrect` boolean, optional `difficulty`, `response` ≤1000, `responseTimeMs`). Returns 201 with the attempt and recalculated mastery, 400 for invalid input, 404 for an unknown topic. |
| STU-8 | Student empty state | `/student` (new account) | No attempts: guidance text in the summary, mastery, and chart; "Generate question" and "Save attempt" are disabled with the note "Log your first quiz attempt before generating targeted practice." |

## Tutor

| ID | Feature | Where | Details |
|---|---|---|---|
| TUT-1 | Tutor dashboard shell | `/tutor` | Header with the tutor's name, a TUTOR label, and "Log out". The intro message comes from `GET /api/tutor/dashboard`. Has loading and error states. |
| TUT-2 | Class-wide "Topics needing attention" | `/tutor` | A table of each topic's average accuracy, "need practice / students" count, and developing count, ranked by need. Shows an empty-state message when there is no roster data. |
| TUT-3 | Roster "Student overview" | `/tutor` | One card per linked student showing name, email, "Focus:" (up to 3 weak topics), overall status and weighted accuracy, and need-practice and developing counts. Shows "No students are linked to your roster yet." when empty. |
| TUT-4 | Student detail expand | `/tutor` roster card | The student-name **button** (`aria-expanded`) toggles a "Full topic breakdown" by subject and a progress chart with a **Topic select**. Data comes from `GET /api/tutor/students/:studentId/progress`. Clicking again collapses it. |
| TUT-5 | Tutor API | `/api/tutor/*` | `GET /dashboard`, `GET /mastery` (the tutor's roster with scores), `GET /students/:studentId/progress` (roster-only; 400 for an invalid ID, 404 if the student is not on the roster). |

## AI (Gemini, server-side only)

| ID | Feature | Where | Details |
|---|---|---|---|
| AI-1 | Generate practice question | `/student` "Practice your weakest topic" | **Button:** "Generate question" (then "New question"; "Creating…" while working; disabled with no topics). Calls `POST /api/student/practice-questions`, which picks the weakest topic and sets difficulty: Needs Practice → Easy, Developing → Medium, Mastered → Hard, Not enough data → Easy. The response has the question, 4 options, difficulty, and topic, **without the answer key**. |
| AI-2 | Answer practice question | Same panel | **Form:** 4 radio options (A–D). **Button:** "Check answer" (disabled until an option is chosen; "Checking…" while submitting). Calls `POST /api/student/practice-questions/:questionId/answer` (body `answer` ≤300, must match one of the options). The server grades the answer, saves a `PRACTICE` attempt, and recalculates mastery in one transaction. The client shows "Correct" / "Not quite", the right answer, the explanation, and the new mastery; the options then lock. |
| AI-3 | Tutor summary | `/tutor` roster card | **Button:** "Generate summary" (then "Refresh summary"; "Writing summary…" while working). Calls `POST /api/tutor/students/:studentId/summary` (roster-only) and returns at most 3 plain-English sentences that prioritise weak topics and treat Not enough data as a reason to gather more evidence. |
| AI-4 | Output validation and storage | Server | Structured JSON output is checked with Zod: 4 unique options, the correct answer must match one option, and length limits apply. Practice questions are stored with choices, answer, explanation, difficulty, and model. Calls use `store: false`. Student names and emails are not sent to Gemini. |
| AI-5 | Provider error handling | Server | Missing key (503), invalid output, timeout (30 s), rate limit, and provider failure all map to short friendly messages. The key and raw provider errors never reach the browser. `/api/health` reports `geminiConfigured`. |

## Database

| ID | Feature | Where | Details |
|---|---|---|---|
| DB-1 | Prisma schema and migrations | `prisma/` | Models: User, Student, Tutor, TutorStudent, Subject, Topic, QuizAttempt, MasteryScore, PracticeQuestion. Foreign keys use deliberate `Restrict`/`Cascade`/`SetNull` rules, with indexes for roster, history, and recency queries. Changes are applied only through migrations (`db:migrate`, `db:deploy`). |
| DB-2 | Append-only attempt history | `QuizAttempt` | Every quiz or practice answer adds a new row; earlier rows are never overwritten. |
| DB-3 | Deterministic mastery scoring | `server/src/services/mastery.ts` | Accuracy = correct ÷ total. With 3 or more attempts: ≥80% Mastered, ≥60% Developing, otherwise Needs Practice. Fewer than 3 attempts: Not enough data. The `MasteryScore` snapshot is recalculated in the same transaction as each new attempt. |
| DB-4 | Seed data | `npm run db:seed` | 1 tutor, 6 students, 2 subjects, 8 topics, 398 attempts, and 48 scores (18 Mastered / 16 Developing / 13 Needs Practice / 1 Not enough data). Running it again refreshes the demo data. |
| DB-5 | Database error handling (BUG-04) | `server/src/middleware/errors.ts` | Prisma connection, initialization, and pool-timeout errors return 503 with "The database is temporarily unavailable. Please try again in a moment." Details are logged on the server only, with no stack trace in the response. |

## Administration

There is **no admin role or admin UI**. Operational tasks are done through the commands and endpoints below. Roster enrollment (linking tutors to students) is not implemented in the app; it currently comes only from the seed.

| ID | Feature | Where | Details |
|---|---|---|---|
| ADM-1 | Health check | `GET /api/health` (public) | Returns `status`, `databaseConfigured`, `databaseConnected` (live `SELECT 1`), and `geminiConfigured`. |
| ADM-2 | Environment configuration | `server/.env` (from `server/.env.example`), `client/.env.example` | `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `GEMINI_API_KEY`, `PORT`, `NODE_ENV`, `VITE_API_BASE_URL`, `VITE_API_PROXY_TARGET`. Secrets are server-only. |
| ADM-3 | Developer scripts | Root `package.json` | `npm run dev`, `build`, `start`, `test`, `lint`, `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:studio` (Prisma Studio for inspecting data). |
| ADM-4 | Production serving | `server/src/index.ts` | With `NODE_ENV=production`, Express serves `client/dist` with an SPA fallback. Cloud Run / Cloud SQL deployment is documented but **not configured**. |
| ADM-5 | Repository hygiene | `.gitignore`, docs | `.env` files are not committed. README, `docs/DEV_LOG.md`, and `docs/IMPROVEMENT_LOG.md` are kept current. |

## Cross-cutting UI and error handling

| ID | Feature | Where | Details |
|---|---|---|---|
| UI-1 | React error boundary (BUG-03) | `client/src/main.tsx` wraps `<App />` | A crash while rendering shows "Something went wrong." with a **"Reload page" button** and a **"Go to home" link**, instead of a blank screen. Error details go to the console only. |
| UI-2 | API error responses (BUG-04) | `server/src/middleware/errors.ts` | Malformed JSON → 400 "The request body is not valid JSON. Check the data and try again." Oversized body (>1 MB) → 413. Unknown `/api/*` route → 404 JSON. Unexpected errors → generic 500 with no internal details. |
| UI-3 | Network failure messaging | Auth forms and dashboards | If the server can't be reached, the forms show "We could not reach the server. Check your connection and try again." Dashboard panels show their own error alerts. |
| UI-4 | Responsive layout | All pages | No page-level horizontal scroll at 375 px. Tables scroll inside their own panels; cards stack on narrow screens. |
| UI-5 | Accessibility basics | All pages | Labelled inputs, `role="alert"`/`role="status"` messages, `aria-pressed` toggles, `aria-expanded` roster buttons, `aria-busy` on submit buttons, and a hidden legend on the practice options. |

---

## User workflows

| ID | Workflow | Steps | Features |
|---|---|---|---|
| WF-1 | First-time student | Register as Student → land on `/student` → see empty-state guidance → practice and logging are disabled until topics exist | AUTH-2, AUTH-3, AUTH-4, STU-8 |
| WF-2 | Returning student practice | Sign in → review mastery, weakest topic, and chart → Generate question → choose an option → Check answer → see feedback and updated mastery → New question | AUTH-1, STU-2–STU-5, AI-1, AI-2, DB-3 |
| WF-3 | Log a quiz result | On `/student`, choose a topic → Correct/Incorrect → Save attempt → that topic's row and the status message update | STU-6, DB-2, DB-3 |
| WF-4 | Tutor roster review | Sign in as tutor → scan topics needing attention → open a student's detail → Generate summary → collapse | AUTH-1, TUT-2–TUT-4, AI-3 |
| WF-5 | Session ends | The session expires (or the cookie is removed) → the next protected request or page load returns 401 → the user lands on `/login` with "Your session has expired, please sign in again." → sign in again and the notice clears | AUTH-6, AUTH-8 |
| WF-6 | Something breaks | A render crash shows the fallback page → Reload page. A database outage shows the friendly 503 message. Bad JSON returns a 400 message. | UI-1, UI-2, DB-5 |
| WF-7 | Logout | Log out → `/login`. Back button or a direct URL does not show dashboard data. | AUTH-5, AUTH-7 |
| WF-8 | Local setup and admin | Copy `.env` → install → create the database → migrate → seed → `npm run dev` → check `/api/health` → inspect data in Prisma Studio | ADM-1–ADM-3, DB-1, DB-4 |
