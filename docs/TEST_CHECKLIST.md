# Test Checklist — Acuity Tutors (Assignment 5.4)

Manual test checklist covering every feature in [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md). The **Feature** column starts with the inventory ID; the coverage table at the end maps every inventory ID to its tests.

- **Source:** the 72 cases from `docs/Acuity Tutors — Test Plan.docx` (2026-10-02) are reused with their original IDs (S, L, R, O, A, M, P, T, D, U, E, V, G). Their earlier result is recorded in **Notes** for reference; **Pass/Fail is blank** because this checklist is for a fresh run against the current code (after BUG-01–BUG-04). New cases use these prefixes: **X** (inventory gaps), **B** (BUG-01–BUG-04 regressions), **W** (weird input), **AX** (accessibility), **SEC** (security).
- **Test types:** Functional, UI, API, Responsive, Database, Authentication, AI, Accessibility, Security.
- **Accounts:** tutor `tutor@acuity.local` / `TutorDemo!2026`; students `ava@`, `noah@`, `mia@`, `liam@`, `zoe@`, `ethan@acuity.local` / `StudentDemo!2026`. Delete any test accounts you create once testing is done.
- **API tests:** run them from the browser DevTools console while on `http://localhost:5173` (so the session cookie is sent), for example `fetch('/api/student/mastery').then(r => r.status)`. You can also use `curl` against `http://localhost:3001`.
- **Expired token for B1–B2:** from the `server/` folder run `node -e "require('dotenv').config({path:'.env'});console.log(require('jsonwebtoken').sign({email:'ava@acuity.local',role:'STUDENT'},process.env.JWT_SECRET,{subject:'x',expiresIn:-60,issuer:'acuity-tutors',audience:'acuity-tutors-web'}))"` and use the output as the `acuity_session` cookie value.
- **Recording a failure:** put what happened in Notes and report it as: "Test [ID] failed: [what you did] → [what happened]."
- **API run (2026-10-04):** cases marked **Pass (API)** passed the server-side part; their note says what still needs a browser check. The API cases are automated in `server/scripts/api-checklist.ts` (`npm run test:api --workspace=server` with the API running). That run creates and then deletes temporary accounts; afterwards run `npm run db:seed` to restore the baseline. Cases needing a different server config (E1, E2, E3, B13, SEC6, X21) were run on temporary instances on ports 3102–3106, which were stopped afterwards.
- **Likely failures:** cases marked "⚠ Expected to fail" describe the behaviour the app *should* have but probably does not yet. They were found while writing this checklist and have not been fixed (no code was changed in this phase).

## 1. Setup and administration

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| S1 | ADM-3 App starts with `npm run dev` from the project root | Frontend and backend start with no terminal errors | Functional | | Plan S1 (Pass) |
| S2 | ADM-3 Frontend loads at `localhost:5173` | Acuity Tutors page loads with styling | UI | | Plan S2 (Pass) |
| S3 | ADM-1 Open `localhost:3001/api/health` | `status: ok`, `databaseConnected: true`, `geminiConfigured: true` | API | Pass | Plan S3 (Pass) 2026-10-04 run: API: all four health fields correct. |
| S4 | ADM-3 `npm run db:studio` | Users, students, topics and quiz attempts are visible in Prisma Studio | Database | | Plan S4 (Pass). The plan ran `npx prisma studio` in `/server`; the documented command is `npm run db:studio` from the root. |
| S5 | DB-2 Stop the app, restart it, log in | All earlier data and new attempts are still there | Database | | Plan S5 (Pass) |
| X19 | DB-1 Run `npx dotenv -e server/.env -- prisma migrate status --schema prisma/schema.prisma` | Reports the database schema is up to date with all committed migrations; no drift | Database | Pass | New 2026-10-04 run: "Database schema is up to date!" — 3 migrations, including the new `practice_question_single_answer`. |
| X20 | DB-4 Run `npm run db:seed`, then check counts in Prisma Studio | 1 tutor, 6 students, 2 subjects, 8 topics, 398 attempts, 48 mastery scores (18 Mastered / 16 Developing / 13 Needs Practice / 1 Not enough data) | Database | Pass | New. Reseeding removes manual test attempts. 2026-10-04 run: Seeded students: 398 attempts, 48 scores (18/16/13/1). The DB also holds 1 extra tutor and 1 extra student created before this phase. |
| X21 | ADM-4 `npm run build`, then start with `NODE_ENV=production` (`$env:NODE_ENV='production'; npm start`) and open `localhost:3001` | Express serves the built client; `/login` and a deep link like `/student` load (SPA fallback); `/api/health` still works | Functional | Pass | New. Cloud Run is not configured; this is a local check only. 2026-10-04 run: `NODE_ENV=production`: `/`, `/login`, `/student` serve the app (200 HTML); `/api/health` 200 JSON. |

## 2. Authentication

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| L1 | AUTH-1/AUTH-4 Tutor login | Redirects to `/tutor` | Authentication | | Plan L1 (Pass) |
| L2 | AUTH-1/AUTH-4 Student login as Ava | Redirects to `/student` | Authentication | | Plan L2 (Pass) |
| L3 | AUTH-1 Ava's email with `WrongPassword!` | "Email or password is incorrect." | Authentication | | Plan L3 (Pass) |
| L4 | AUTH-1 `nobody@acuity.local` with any password | Same generic error; does not reveal whether the email exists | Security | | Plan L4 (Pass) |
| L5 | AUTH-1 Click Sign in with both fields empty | Validation message; no request in the Network tab | Functional | | Plan L5 (Pass) |
| L6 | AUTH-1 Enter `ava-acuity` as the email | "Enter a valid email address." | Functional | | Plan L6 (Pass) |
| L7 | AUTH-1 Log in and watch the button | Shows "Please wait…" and is disabled; cannot double-submit | UI | | Plan L7 (Pass). See also W27. |
| R1 | AUTH-2 Register a new test account | Account created, signed in, and redirected by role | Authentication | | Plan R1 (Pass) |
| R2 | AUTH-2 Register with `ava@acuity.local` | "An account with this email already exists." | Functional | | Plan R2 (Pass) |
| R3 | AUTH-3 Register with password `123` | Inline error "Use at least 8 characters, including a letter and a number."; server returns 400 if bypassed | Security | | Plan R3 (Passed after fix) |
| R4 | AUTH-2 Leave name or email empty | Validation errors for the empty fields | Functional | | Plan R4 (Pass) |
| R5 | STU-8 Log in as the new student account | Empty-state guidance; practice disabled | Functional | | Plan R5 (Pass) |
| O1 | AUTH-7 Click Log out | Returns to the sign-in page | Authentication | | Plan O1 (Pass) |
| O2 | AUTH-5 Press the browser Back button after logout | No dashboard data shown; sent to login | Security | | Plan O2 (Pass) |
| O3 | AUTH-5 Type `localhost:5173/student` after logout | Redirects to login | Authentication | | Plan O3 (Pass) |
| O4 | AUTH-6 Press F5 on a dashboard while logged in | Stays logged in | Authentication | | Plan O4 (Pass) |
| X15 | AUTH-6 DevTools → Application → Cookies after sign-in | `acuity_session` is HttpOnly, SameSite=Strict, and expires about 8 hours after sign-in; `document.cookie` in the console does not show it | Security | | New. Secure flag applies only with `NODE_ENV=production`. |
| X16 | AUTH-10 Signed out: `fetch('/api/auth/me')`; signed in: `fetch('/api/auth/logout',{method:'POST'})` | `/me` → 401 with `code: "AUTH_REQUIRED"`; logout → 204 and the cookie is cleared | API | Pass | New 2026-10-04 run: `/me` 401 `AUTH_REQUIRED`; logout 204 and cookie cleared. |
| X22 | AUTH-2/TUT-3 Register choosing the Tutor role toggle | Lands on `/tutor` with "No students are linked to your roster yet." | Functional | | New. See SEC3 about open tutor registration. |

## 3. Role access and security

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| A1 | AUTH-5 As Ava, go to `/tutor` | Redirected to `/student` | Security | | Plan A1 (Pass) |
| A2 | AUTH-5 As tutor, go to `/student` | Redirected to `/tutor` | Security | | Plan A2 (Pass) |
| A3 | AUTH-9 Logged out, open `localhost:3001/api/student/mastery` | 401 JSON error; no data | API | Pass | Plan A3 (Pass). The plan's note "Cannot GET /student" suggests the path was missing `/api`; retest with the full `/api/...` path. 2026-10-04 run: `/api/student/mastery` signed out → 401 "Please sign in to continue." |
| A4 | AUTH-9 As Ava, review all scores | Only Ava's topics appear | Security | | Plan A4 (Pass) |
| A5 | AI-5 F12 → Network, generate a question, inspect every request and response | No Gemini API key appears anywhere | Security | | Plan A5 (Pass) |
| A6 | AUTH-3 Open the User table in Prisma Studio | Passwords are bcrypt hashes (`$2…`), not plain text | Security | Pass | Plan A6 (Pass) 2026-10-04 run: All 9 users have bcrypt hashes. |
| X17 | AUTH-9 As tutor: `fetch('/api/student/mastery')`; as Ava: `fetch('/api/tutor/mastery')` | Both return 403 "You do not have permission to access this page." | Security | Pass | New. A1/A2 check the client only; this checks the server. 2026-10-04 run: Both directions 403. |
| X9 | TUT-5 As tutor, request `/api/tutor/students/<id>/progress` for a student not on the roster (register a new student and copy its `Student.id` from Prisma Studio) | 404 "This student is not in your roster."; no data | Security | Pass | New 2026-10-04 run: 404 "This student is not in your roster." |
| X10 | AI-3 As Ava: `fetch('/api/tutor/students/<Ava's Student.id>/summary',{method:'POST'})` | 403; no summary is generated | Security | Pass | New 2026-10-04 run: 403; no summary. |

## 4. Mastery scoring

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| M1 | DB-3 Count one student's correct and total attempts for one topic in Prisma Studio | The percentage matches the dashboard | Database | Pass | Plan M1 (Pass) 2026-10-04 run: Script recomputed all 48 seeded scores from attempts: 0 mismatches. |
| M2 | DB-3 Find a topic at 80% or above (3+ attempts) | Labelled Mastered | Functional | | Plan M2 (Pass) |
| M3 | DB-3 Find a topic at 60–79% | Labelled Developing | Functional | | Plan M3 (Pass) |
| M4 | DB-3 Find a topic below 60% | Labelled Needs Practice | Functional | | Plan M4 (Pass) |
| M5 | DB-3 Find a topic with fewer than 3 attempts | Labelled Not enough data | Functional | | Plan M5 (Pass) |
| M6 | DB-3/AI-2 Answer an AI question correctly | That topic's score rises | Functional | | Plan M6 (Pass) |
| M7 | DB-3/AI-2 Answer an AI question incorrectly | That topic's score drops | Functional | | Plan M7 (Pass) |
| M8 | DB-3 Keep answering until a topic crosses 60% or 80% | The label updates | Functional | | Plan M8 (Pass) |
| M9 | DB-3 Run `npm test` | All server and client tests pass | Functional | Pass | Plan M9 (Pass). Now runs 15 server + 8 client tests. 2026-10-04 run: `npm test`: 18 server + 9 client tests pass. |
| X23 | DB-2 Note an existing attempt's `attemptedAt` and `isCorrect` in Prisma Studio, log a new attempt for that topic, then refresh | One new row is added; the earlier row is unchanged | Database | | New |

## 5. AI practice questions and tutor summaries

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| P1 | AI-1 As Ava, click Generate question | "Creating…", then a question with 4 options | AI | | Plan P1 (Pass) |
| P2 | AI-1/STU-5 Compare the question topic with Ava's scores | The question is on her weakest topic (matches the TOP PRIORITY cue) | AI | | Plan P2 (Pass) |
| P3 | AI-1 Check the difficulty shown | Needs Practice → Easy, Developing → Medium, Mastered → Hard, Not enough data → Easy | AI | | Plan P3 (Pass) |
| P4 | AI-2 Pick the right option, click Check answer | "Correct", answer and explanation shown | AI | | Plan P4 (Pass) |
| P5 | AI-2 Pick a wrong option | "Not quite", the correct answer and explanation shown | AI | | Plan P5 (Pass) |
| P6 | AI-2 Try Check answer without choosing | The button is disabled until an option is selected | AI | | Plan P6 (Pass) |
| P7 | AI-2 Click Check answer twice quickly | Only one attempt is saved | Functional | | Plan P7 (Pass). The client disables the button; see W31 for the server-side gap. |
| P8 | AI-1 Generate 3 questions in a row | Each question is different | AI | | Plan P8 (Pass) |
| P9 | AI-4 Check PracticeQuestion and QuizAttempt in Prisma Studio | The new question (with choices, answer, explanation, difficulty, model) and a `PRACTICE` attempt are stored | Database | | Plan P9 (Pass) |
| P10 | AI-1 Repeat as Noah | The question targets Noah's own weakest topic | AI | | Plan P10 (Pass) |
| T1 | AI-3 As tutor, click Generate summary on a student | "Writing summary…", then a summary of 3 sentences or fewer | AI | | Plan T1 (Pass) |
| T2 | AI-3 Compare the summary with the student's scores | It names the student's actual weak topics | AI | | Plan T2: **no result recorded** (the plan's summary counts it as passed) |
| T3 | AI-3 Generate for 2–3 students | Each summary is specific to that student | AI | | Plan T3: **no result recorded** |
| T4 | AI-3 Generate for a student with no attempts | Says more data is needed; invents no weaknesses | AI | | Plan T4: **no result recorded**. Needs a no-attempt student on the roster; the seed has none (link one through the seed or in Prisma Studio). |
| X11 | AI-1 Network tab → response of `POST /api/student/practice-questions` | Contains the question, options, difficulty, and topic, but **no** `correctAnswer` or `explanation` | Security | Pass | New 2026-10-04 run: 201; keys `difficulty,id,options,question,topic,topicId` only. |
| X12 | AI-2 Console: answer a generated question with `{"answer":"not an option"}` | 400 "Choose one of the four options shown for this question."; no attempt saved | API | Pass | New 2026-10-04 run: 400; no attempt saved. |
| X13 | AI-4 Review the prompt builders and request in `server/src/services/gemini.ts` and `server/src/routes/gemini.ts` | Only subject, topic, accuracy, status, attempt counts, and difficulty are sent; no student name, email, or IDs | AI | Pass | New. A code review check. 2026-10-04 run: Code review: prompts receive only subject, topic, accuracy, mastery level, attempt count, and difficulty. |
| X14 | AI-5 Run `npm test --workspace=server` | The Gemini tests for valid, malformed, and schema-invalid JSON, 429, and timeout pass | AI | Pass | New 2026-10-04 run: Gemini tests pass. |

## 6. Dashboards

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| D1 | STU-1/STU-3 Log in as Ava | Topics grouped by subject with colour-coded levels | UI | | Plan D1 (Pass) |
| D2 | STU-2 Check the top of the student dashboard | Counts such as "3 topics mastered, 2 need practice · 3 developing" | UI | | Plan D2 (Pass) |
| D3 | STU-4 View the progress section, then answer a question | The chart displays and updates | UI | | Plan D3 (Pass) |
| D4 | STU-8 Log in as a new student | Friendly guidance, not a blank page | UI | | Plan D4 (Pass) |
| U1 | TUT-3 Log in as tutor | All 6 students listed with weak topics | UI | | Plan U1 (Pass) |
| U2 | TUT-2 Check "Topics needing attention" | Class-wide weakest topics display correctly | UI | | Plan U2 (Pass) |
| U3 | TUT-4 Click a student on the roster | Full topic breakdown and progress chart | UI | | Plan U3 (Pass) |
| U4 | TUT-1/TUT-3 Answer a question as Ava, then reload the tutor view | Ava's new score appears | Functional | | Plan U4 (Pass) |
| X1 | STU-4 Change the chart's Topic dropdown | The chart redraws for the selected topic | UI | | New |
| X2 | STU-5 Compare the TOP PRIORITY card with the mastery tables | It shows the lowest-accuracy Needs Practice topic (or Developing if there is none) | Functional | | New |
| X3 | STU-6 Log an attempt: choose a topic, Correct, Save attempt | "Saved. {status} after N attempts."; that row's attempt count goes up by 1 and its accuracy updates | Functional | | New |
| X4 | STU-6 Click Incorrect, then Save attempt | Incorrect shows as selected (`aria-pressed="true"`); the attempt is saved as incorrect and accuracy drops | Functional | | New |
| X5 | STU-6/STU-8 New student with no topics | The Topic select and "Save attempt" are disabled | UI | | New |
| X6 | STU-7 Console: `fetch('/api/student/attempts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topicId:'x',isCorrect:'yes'})})` | 400 with field details for `topicId` and `isCorrect` | API | Pass | New 2026-10-04 run: 400 with details for `topicId` and `isCorrect`. |
| X7 | STU-7 The same, with a well-formed but non-existent CUID `topicId` and `isCorrect: true` | 404 "Topic not found."; no attempt saved | API | Pass | New 2026-10-04 run: 404 "Topic not found."; attempt count unchanged. |
| X8 | TUT-4 Click an expanded student's name again | Detail collapses; `aria-expanded` returns to `false` | UI | | New |

## 7. Error handling and edge cases

Restore everything afterwards: correct key back in `server/.env`, `Start-Service postgresql-x64-18`, restart the app.

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| E1 | AI-5 Change one character of `GEMINI_API_KEY`, restart, generate a question | Friendly error; the key is never shown | AI | Pass (API) | Plan E1 (Pass) 2026-10-04 run: Instance with an invalid key: generate → 502 "The AI tutor could not create a reliable response…"; key not in the response or the log. Browser: check the message on the page. |
| E2 | AI-5/ADM-1 Remove the key value, restart | Health shows `geminiConfigured: false`; friendly error on generate | AI | Pass (API) | Plan E2 (Pass) 2026-10-04 run: Instance with no key: health `geminiConfigured: false`; generate → 503 "AI practice is not configured yet…". Browser: check the message on the page. |
| E3 | DB-5/ADM-1 `Stop-Service postgresql-x64-18`, then reload and act | Friendly "The database is temporarily unavailable…" message (503); health shows `databaseConnected: false` | Database | Pass (API) | Plan E3 (Pass). The expected message is new since BUG-04. 2026-10-04 run: Health `databaseConnected: false`; API 503 friendly message (see B13). Browser: check with the real service stopped. |
| E4 | UI-3 Stop the server, then use the app | "We could not reach the server…" style message | UI | | Plan E4 (Pass) |
| E5 | AUTH-4 Open `localhost:5173/random-page` | Redirect to login or the dashboard; not a blank screen | Functional | | Plan E5 (Pass) |
| X18 | UI-2 `fetch('/api/does-not-exist').then(r=>r.json())` | 404 `{ "error": "API route not found" }` | API | Pass | New 2026-10-04 run: 404 "API route not found". |

## 8. Mobile and responsive

Use DevTools device mode (F12 → phone/tablet icon).

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| V1 | UI-4 iPhone SE (375 px) | No sideways page scrolling | Responsive | | Plan V1 (Pass) |
| V2 | UI-4/AUTH-1 Log in at phone size | Form usable; buttons easy to tap | Responsive | | Plan V2 (Pass) |
| V3 | UI-4/STU-3 Student dashboard on phone | Readable; cards stack vertically | Responsive | | Plan V3 (Pass) |
| V4 | UI-4/TUT-3 Tutor dashboard on phone | Tables scroll inside their own panel | Responsive | | Plan V4 (Pass) |
| V5 | UI-4 iPad size | The layout adjusts cleanly | Responsive | | Plan V5 (Pass) |

## 9. Repository and documentation

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| G1 | ADM-5 Run `git status` and `git log --stat` | No `.env` file in any commit | Security | Pass | Plan G1 (Pass) 2026-10-04 run: No `.env` file in any commit (`git log --all --name-only`). |
| G2 | ADM-3 Follow the README setup from the top | Steps are accurate and complete | Functional | | Plan G2 (Pass) |
| G3 | ADM-2 Compare README and `.env.example` files with `server/.env` | Every variable is listed with a placeholder | Functional | | Plan G3 (Pass) |
| G4 | ADM-5 Open `docs/DEV_LOG.md` and `docs/IMPROVEMENT_LOG.md` | Every phase has timestamped entries; improvements have commit hashes | Functional | | Plan G4 (Pass). DEV_LOG has duplicate "Complete Mastery Dashboards" and "Gemini" entries. |

## 10. BUG-01 to BUG-04 regressions

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| B1 | AUTH-8 (BUG-01) Set `acuity_session` to an expired token (see "Expired token" above), then reload | Sign-in page shows "Your session has expired, please sign in again." | Authentication | | New |
| B2 | AUTH-8 (BUG-01) `curl -i localhost:3001/api/auth/me -H "Cookie: acuity_session=<expired token>"` | 401, `code: "SESSION_EXPIRED"`, a `Set-Cookie` that clears `acuity_session` | API | Pass | New. Automated: `server/tests/auth.test.ts`. 2026-10-04 run: 401 `SESSION_EXPIRED`, cookie cleared. |
| B3 | AUTH-8 (BUG-01) Change one character of a valid `acuity_session` value, then reload | Sign-in page with no crash; the API returns `code: "SESSION_INVALID"` | Security | Pass (API) | New 2026-10-04 run: API 401 `SESSION_INVALID`. Browser: confirm sign-in page, no crash. |
| B4 | AUTH-8 (BUG-01) Open `/login` in a fresh private window | No session-expired message on a normal signed-out visit | Authentication | | New. Automated: `client/tests/session.test.tsx`. |
| B5 | AUTH-8 (BUG-02) As Ava, delete `acuity_session` in DevTools, then click Generate question | Immediately sent to `/login` with the expired message | Authentication | | New |
| B6 | AUTH-8/STU-6 (BUG-02) As Ava, delete the cookie, then Save attempt | Sent to `/login` with the expired message; no attempt saved | Authentication | | New |
| B7 | AUTH-8/TUT-4 (BUG-02) As tutor, delete the cookie, then expand a student or click Generate summary | Sent to `/login` with the expired message | Authentication | | New |
| B8 | AUTH-8 (BUG-02) On `/login`, enter a wrong password | Only "Email or password is incorrect."; no session-expired message | Authentication | | New |
| B9 | AUTH-8 After B5, sign in again, log out, and view `/login` | The expired message is gone after a successful sign-in | UI | | New |
| B10 | UI-1 (BUG-03) Temporarily add `throw new Error('test')` as the first line of `ProgressChart` in `client/src/App.tsx`, sign in as Ava, then remove it | "Something went wrong." page with a Reload page button and a Go to home link; the text "test" is not shown; the console logs the error | UI | | New. Automated: `client/tests/ErrorBoundary.test.tsx`. |
| B11 | UI-1 (BUG-03) Repeat B10 at 375 px | The fallback is centred and readable; no horizontal scroll | Responsive | | New |
| B12 | UI-2 (BUG-04) `fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'}).then(r=>r.json())` | 400 "The request body is not valid JSON. Check the data and try again." | API | Pass | New. Automated: `server/tests/errors.test.ts`. 2026-10-04 run: 400 with the JSON message. |
| B13 | DB-5 (BUG-04) Stop PostgreSQL, then try to sign in | The form shows "The database is temporarily unavailable. Please try again in a moment."; the Network response is 503 with no stack, host, or port; the server terminal logs the details | Database | Pass (API) | New 2026-10-04 run: Instance pointed at a closed DB port: login 503 with the friendly message, no stack/host/port; details only in the server log. Browser: check the form shows it. |
| B14 | UI-2 (BUG-04) POST a JSON body larger than 1 MB to `/api/auth/login` | 413 "The request body is too large." | API | Pass | New 2026-10-04 run: 1.1 MB body → 413 "The request body is too large." |
| B15 | UI-2 (BUG-04) Any unexpected server error | Generic 500 "Something went wrong. Please try again." with no internal message | API | Pass | New. Automated only (`server/tests/errors.test.ts`); hard to trigger by hand. 2026-10-04 run: Automated: `server/tests/errors.test.ts`. |

## 11. Weird input

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| W1 | AUTH-2 Very long text: paste 500 characters into Full name | The input stops at 80; if sent through the API with 81+, 400 "Use 80 characters or fewer." | Functional | Pass (API) | New 2026-10-04 run: API: 81 chars → 400 "Use 80 characters or fewer." Browser: check the input stops at 80. |
| W2 | AUTH-1/AUTH-2 Very long text: a 300-character email | The input stops at 254; the API returns 400 for longer values; no 500 | Functional | Pass (API) | New 2026-10-04 run: API: register and login both 400. Browser: check the 254 input limit. |
| W3 | AUTH-3 Very long text: a 200-character password | The input stops at 128; the API returns 400 for 129+ | Security | Pass (API) | New 2026-10-04 run: API: 129 chars → 400. Browser: check the 128 input limit. |
| W4 | AI-2 Very long text: answer a question through the API with a 5,000-character `answer` | 400 validation error; no attempt saved | API | Pass | New 2026-10-04 run: 400. |
| W5 | STU-7 Very long text: `POST /api/student/attempts` with a 2,000-character `response` | 400 validation error | API | Pass | New 2026-10-04 run: 400. |
| W6 | AUTH-2/STU-1 Emoji: register with name `Ava 🚀📚` | Account created; the name displays correctly in the dashboard header | Functional | Pass (API) | New 2026-10-04 run: API: 201 and `/me` returns `Ava 🚀📚`. Browser: check the header display. |
| W7 | AUTH-2 Emoji: register with email `ava🙂@acuity.local` | A clear validation error (client or server 400); no 500 | Functional | Pass | New. The client email check allows non-ASCII, so the server must reject it. 2026-10-04 run: Server 400 (Zod rejects the non-ASCII email). |
| W8 | AUTH-3 Emoji: register with password `Passw0rd🙂`, log out, then log in with it | Registration succeeds and the same password signs in | Authentication | Pass | New 2026-10-04 run: Register 201, login 200 with the emoji password. |
| W9 | AUTH-2 Spaces only: Full name `     ` | "Enter your name using at least 2 characters."; the API also returns 400 (it trims spaces) | Functional | Pass (API) | New 2026-10-04 run: API 400. Browser: check the inline message. |
| W10 | AUTH-1 Spaces only: email `   ` | "Enter a valid email address." | Functional | Pass (API) | New 2026-10-04 run: API 400. Browser: check the inline message. |
| W11 | AUTH-3 Spaces only: register with an 8-space password; log in to Ava with a spaces-only password | Register: the password rule error. Login: the generic incorrect message (401) | Security | Pass | New 2026-10-04 run: Register 400; login 401 generic message. |
| W12 | AUTH-2 Name with surrounding spaces `  Ava Test  ` | Saved and displayed trimmed as `Ava Test` | Functional | Pass | New 2026-10-04 run: Stored as `Ava Test`. |
| W13 | AUTH-1 SQL injection: email `' OR 1=1 --` | "Enter a valid email address."; the API returns 400 if bypassed; no sign-in | Security | Pass (API) | New 2026-10-04 run: API 400, no cookie. Browser: check the inline message. |
| W14 | AUTH-1 SQL injection: `ava@acuity.local` with password `' OR 1=1 --` | Generic "Email or password is incorrect." (401) | Security | Pass | New 2026-10-04 run: 401 "Email or password is incorrect.", no cookie. |
| W15 | AUTH-2 SQL injection: register with name `' OR 1=1 --` | The account is created and the name is shown literally; other data is unaffected (Prisma uses parameterised queries) | Security | Pass | New. Delete the account afterwards. 2026-10-04 run: Stored literally; user count +1 only. |
| W16 | STU-7 SQL injection: `POST /api/student/attempts` with `topicId: "' OR 1=1 --"` | 400 (not a valid CUID); no attempt saved | Security | Pass | New 2026-10-04 run: 400; attempt count unchanged. |
| W17 | AUTH-2/STU-1 XSS: register with name `<script>alert(1)</script>` | No alert pops up; the header shows the literal text | Security | Pass (API) | New. Delete the account afterwards. 2026-10-04 run: API: stored literally, JSON response. Browser: confirm no alert and literal text in the header. |
| W18 | TUT-3/AI-3 XSS on the tutor view: in Prisma Studio, set Noah's `displayName` to `<script>alert(1)</script>`, open `/tutor`, generate a summary, then restore the name | No alert; the roster shows the literal text; the summary is generated normally | Security | | New. Restore "Noah …" afterwards (or reseed). |
| W19 | AUTH-1 XSS: email `<script>alert(1)</script>@x.com` | Validation error; nothing runs | Security | Pass (API) | New 2026-10-04 run: API 400. Browser: check the inline message. |
| W20 | AI-2 XSS: answer a question through the API with `<script>alert(1)</script>` | 400 "Choose one of the four options…" | Security | Pass | New 2026-10-04 run: 400 "Choose one of the four options…" |
| W21 | TUT-5 Negative ID: `fetch('/api/tutor/students/-1/progress')` as tutor | 400 "Student identifier is not valid." | API | Pass | New 2026-10-04 run: 400 "Student identifier is not valid." |
| W22 | TUT-5/AI-3 Non-numeric/garbage ID: `/api/tutor/students/abc/progress` (GET) and `/api/tutor/students/123/summary` (POST) | Both 400 "Student identifier is not valid."; no Gemini call | API | Pass | New 2026-10-04 run: Both 400; no Gemini call. |
| W23 | AI-2 Negative ID: `POST /api/student/practice-questions/-1/answer` as Ava | 400 "This practice question is not valid." | API | Pass | New 2026-10-04 run: 400 "This practice question is not valid." |
| W24 | AI-2 Valid-looking ID owned by another student: copy one of Noah's `PracticeQuestion.id` values and answer it as Ava | 404 "Practice question not found."; no attempt saved | Security | Pass | New 2026-10-04 run: 404 "Practice question not found."; no attempt saved. |
| W25 | AUTH-4 Odd client URLs: `localhost:5173/student/-1`, `/tutor/abc`, `/student?id=' OR 1=1 --` | Redirect to the user's own dashboard (or `/login`); never a blank page or another user's data | Functional | | New |
| W26 | TUT-5 Injection in a URL ID: `/api/tutor/students/abc'%20OR%201=1--/progress` | 400; no data | Security | Pass | New 2026-10-04 run: 400. |
| W27 | AUTH-1 Double-click: Sign in | One `POST /api/auth/login` in the Network tab; one redirect | UI | | New |
| W28 | AUTH-2 Double-click: Create account | One account is created; no "already exists" error flashes | Functional | | New |
| W29 | STU-6 Double-click: Save attempt | Exactly one new QuizAttempt (attempt count +1, not +2) | Database | | New |
| W30 | AI-2 Double-click: Check answer | One `PRACTICE` attempt saved | Database | | New. Same as P7, checked in Prisma Studio. 2026-10-04 run: The API double-submit race is covered by W31 (DB-enforced). Browser double-click still to check. |
| W31 | AI-2 Answer the same practice question twice through the API (repeat the `fetch` call) | The second answer is rejected with 409 "This question has already been answered."; two simultaneous answers produce one 201 and one 409; only one attempt is stored | Database | Fail → Pass (BUG-05) | New. Found while writing the checklist. 2026-10-04 run: Before fix: second answer 201, two simultaneous answers both 201, 2 rows each. After fix: second answer 409 "This question has already been answered."; simultaneous answers 201 + 409; 1 row each. |
| W32 | AI-1 Double-click: Generate question | One new PracticeQuestion row (one Gemini call) | AI | | New |
| W33 | AI-3 Double-click: Generate summary | One summary request in the Network tab | AI | | New |
| W34 | AUTH-7 Double-click: Log out | One clean return to `/login`; no error | UI | | New |
| W35 | UI-1 Double-click: Reload page on the error fallback (during B10) | The page reloads once; no error | UI | | New |

## 12. Accessibility

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| AX1 | UI-5/AUTH-1 Keyboard only: sign in | Tab order is Email → Password → Sign in → Create an account; focus is always visible; Enter submits | Accessibility | | New |
| AX2 | UI-5/AI-2 Keyboard only: Generate question, choose an answer, Check answer | All controls are reachable; arrow keys move between options; Enter/Space activates | Accessibility | | New |
| AX3 | UI-5/STU-6 Keyboard only: Log an attempt | The Topic select, Correct/Incorrect, and Save attempt all work; a screen reader announces Correct/Incorrect as pressed or not pressed | Accessibility | | New |
| AX4 | UI-5/AUTH-8 Screen reader (Windows Narrator): wrong password, then a session-expired sign-in | Both messages are announced automatically (`role="alert"` / `role="status"`) | Accessibility | | New |
| AX5 | UI-5/TUT-4 Screen reader on the roster student-name button | Announced as a button with expanded/collapsed state | Accessibility | | New |
| AX6 | UI-5 Lighthouse → Accessibility on `/login`, `/student`, `/tutor` | Score of 90 or more; no colour-contrast or missing-label failures (record scores in Notes) | Accessibility | | New |
| AX7 | UI-1 Error fallback (during B10) with keyboard and screen reader | The "Something went wrong." heading is announced; Reload page is reachable with Tab | Accessibility | | New |
| AX8 | UI-4/UI-5 Browser zoom 200% on each page | No content is cut off; no horizontal page scroll | Accessibility | | New |
| AX9 | STU-4/TUT-4 The accuracy chart with a screen reader | The chart data is available as text (summary, table, or label) | Accessibility | | New. ⚠ Expected to fail: the chart has no text alternative. |
| AX10 | STU-3/TUT-3 Mastery statuses in greyscale (DevTools → Rendering → Emulate vision deficiency) | Status is readable from the text labels, not colour alone | Accessibility | | New |

## 13. Additional security

| ID | Feature | Expected result | Test type | Pass/Fail | Notes |
|---|---|---|---|---|---|
| SEC1 | ADM-1 Open `/api/health` signed out | Only booleans and `status`; no secrets, versions, or connection strings | Security | Pass | New 2026-10-04 run: Only `status` + three booleans. |
| SEC2 | AUTH-1 Try 20 wrong passwords for Ava within a minute | Further attempts are slowed or blocked (rate limit, 429) | Security | Fail | New. ⚠ Expected to fail: no rate limiting. 2026-10-04 run: 20 wrong logins all 401, no 429. Deferred to the security phase. |
| SEC3 | AUTH-2 Register as Tutor with no invite | Tutor accounts should require approval or an invite | Security | Fail | New. ⚠ Expected to fail: anyone can self-register as Tutor. Needs a product decision. 2026-10-04 run: Self-registered tutor → 201. Deferred to the security phase. |
| SEC4 | ADM-4 Inspect the response headers of `/` and `/api/health` | Security headers present (for example `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`); no `X-Powered-By` | Security | Fail | New. ⚠ Expected to fail for the headers (no helmet); `X-Powered-By` is already disabled. 2026-10-04 run: No CSP / nosniff / frame headers (`X-Powered-By` correctly absent). Deferred to the security phase. |
| SEC5 | ADM-3 Run `npm audit` | 0 vulnerabilities | Security | Pass | New 2026-10-04 run: 0 vulnerabilities. |
| SEC6 | AUTH-10 Remove `JWT_SECRET` (or make it shorter than 32 characters), restart, then sign in | 503 "Authentication is not configured on this server."; no crash | Security | Pass | New. Restore the secret afterwards. 2026-10-04 run: Short `JWT_SECRET` → login 503 "Authentication is not configured on this server." |
| SEC7 | AUTH-2 Sign-in and registration copy | Security wording is accurate: "Your password is securely hashed before it is stored." | Security | Fail → Pass (BUG-06) | New. The page said "encrypted"; passwords are hashed (bcrypt). 2026-10-04 run: Text now reads "Your password is securely hashed before it is stored." Client test checks it; quick visual check on `/login` still useful. |

## Coverage by feature

| Feature ID | Tests |
|---|---|
| AUTH-1 | L1–L7, W2, W10, W13, W14, W19, W27, AX1, SEC2, V2 |
| AUTH-2 | R1, R2, R4, X22, W1, W6, W7, W9, W12, W15, W17, W28, SEC3, SEC7 |
| AUTH-3 | R3, A6, W3, W8, W11 |
| AUTH-4 | L1, L2, E5, W25 |
| AUTH-5 | O2, O3, A1, A2 |
| AUTH-6 | O4, X15 |
| AUTH-7 | O1, W34 |
| AUTH-8 | B1–B9, AX4 |
| AUTH-9 | A3, A4, X17 |
| AUTH-10 | X16, SEC6 |
| STU-1 | D1, W6, W17 |
| STU-2 | D2 |
| STU-3 | D1, V3, AX10 |
| STU-4 | D3, X1, AX9 |
| STU-5 | P2, X2 |
| STU-6 | X3, X4, X5, B6, W29, AX3 |
| STU-7 | X6, X7, W5, W16 |
| STU-8 | R5, D4, X5 |
| TUT-1 | U4 |
| TUT-2 | U2 |
| TUT-3 | U1, U4, X22, V4, W18, AX10 |
| TUT-4 | U3, X8, B7, AX5, AX9 |
| TUT-5 | X9, W21, W22, W26 |
| AI-1 | P1–P3, P8, P10, X11, W32 |
| AI-2 | P4–P7, M6, M7, X12, W4, W20, W23, W24, W30, W31, AX2 |
| AI-3 | T1–T4, X10, W18, W22, W33 |
| AI-4 | P9, X13 |
| AI-5 | A5, E1, E2, X14 |
| DB-1 | X19 |
| DB-2 | S5, X23 |
| DB-3 | M1–M9 |
| DB-4 | X20 |
| DB-5 | E3, B13 |
| ADM-1 | S3, E2, E3, SEC1 |
| ADM-2 | G3 |
| ADM-3 | S1, S2, S4, G2, SEC5 |
| ADM-4 | X21, SEC4 |
| ADM-5 | G1, G4 |
| UI-1 | B10, B11, W35, AX7 |
| UI-2 | X18, B12, B14, B15 |
| UI-3 | E4 |
| UI-4 | V1–V5, B11, AX8 |
| UI-5 | AX1–AX8 |

**Totals:** 72 reused plan cases + 23 X + 15 B + 35 W + 10 AX + 7 SEC = **162 cases**.
