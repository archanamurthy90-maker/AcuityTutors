# Manual Run Sheet — 95 Browser Cases

This sheet reorders every case in [TEST_CHECKLIST.md](TEST_CHECKLIST.md) whose Pass/Fail is still blank (95 cases) into one walkthrough, grouped by page and account. Tick the box as you go, then copy the results into the checklist's Pass/Fail column. For a failure, note what happened.

**Columns**
- **AI:** this step makes a Gemini call (`Q1`–`Q5` for questions, `S1`–`S4` for summaries; see the call plan below). `0` means the step involves AI but makes no call.
- **Video:** this step is covered by [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md) at that timestamp. Record the result while filming.

**Accounts:** tutor `tutor@acuity.local` / `TutorDemo!2026`; students `ava@`, `noah@`, `mia@`, `liam@acuity.local` / `StudentDemo!2026`.

## Gemini call plan (9 calls; 12 with the video, within the 20-per-day free tier)

| Call | Account | Covers |
|---|---|---|
| Q1 | Ava (double-click Generate) | W32, P1, P2, P3, A5, P6, P7/W30, P4 or P5, M6 or M7, P9 |
| Q2 | Ava ("New question") | The other of P4/P5 and M6/M7 |
| Q3 | Ava ("New question") | P8 (three different questions) |
| Q4 | Noah | P10 |
| Q5 | Mia | RAI15 (fifth question, different student and subject) |
| S1 | Tutor → Ava (double-click) | W33, T1, T2, RAI16 |
| S2 | Tutor → Noah (renamed for W18) | W18, T3, RAI16 |
| S3 | Tutor → Liam | T3, RAI16 |
| S4 | Tutor → no-attempt student | T4 |

If you film on the same day, the video's question can replace Q1 and its summary can replace S1. Record those results on camera.

## Setup
1. Run `npm run db:seed`, then restart `npm run dev`. The restart clears the in-memory rate-limit counters.
2. Open Prisma Studio with `npm run db:studio`. Keep it in a second tab.
3. Use Edge, and keep DevTools (**F12**) open on the **Network** tab with **Preserve log** ticked.
4. Pick a fresh registration email, for example `run.student1@example.com`.

---

## 1. Setup and app start (no account)

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 1 | S1 | Run `npm run dev` from the project root | Client and API start with no terminal errors | | | ☐ P ☐ F |
| 2 | S2 | Open `localhost:5173` | Acuity Tutors loads with styling | | 0:00 | ☐ P ☐ F |
| 3 | S4 | Open Prisma Studio (`npm run db:studio`) | Users, students, topics, and quiz attempts are visible | | | ☐ P ☐ F |

## 2. Signed out: sign-in page (open a fresh InPrivate window, **Ctrl + Shift + N**)

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 4 | B4 | Open `localhost:5173/login` in the InPrivate window | No session-expired message | | | ☐ P ☐ F |
| 5 | E5 | Open `localhost:5173/random-page` | Redirects to `/login`, not a blank page | | | ☐ P ☐ F |
| 6 | L5 | Click **Sign in** with both fields empty | Errors under Email and Password; no `/api/auth/login` request in Network | | | ☐ P ☐ F |
| 7 | L6 | Enter `ava-acuity` as the email and submit | "Enter a valid email address." under Email | | | ☐ P ☐ F |
| 8 | L4 | Sign in as `nobody@acuity.local` with any password | Generic "Email or password is incorrect." | | | ☐ P ☐ F |
| 9 | L3 | Sign in as `ava@acuity.local` with `WrongPassword!` | "Email or password is incorrect." | | 0:40 | ☐ P ☐ F |
| 10 | B8 | Look at the page after the wrong password | Only the incorrect-password message; no session-expired message | | 0:40 | ☐ P ☐ F |

## 3. Registration (new student)

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 11 | X22 | Click **Create an account** and look for a Tutor option | No Student/Tutor toggle; the note "This creates a student account…" is shown | | 0:10 | ☐ P ☐ F |
| 12 | R4 | Submit with Full name and Email empty | Errors under both fields; focus on Full name | | | ☐ P ☐ F |
| 13 | R3 | Enter a valid name and email with the password `123` | "Use at least 8 characters, including a letter and a number." under Password | | 0:10 | ☐ P ☐ F |
| 14 | R2 | Use `ava@acuity.local` with a valid password | "An account with this email already exists." | | 0:10 | ☐ P ☐ F |
| 15 | W28 | Use the fresh email and **double-click** Create account | One `POST /api/auth/register` in Network; no "already exists" error | | | ☐ P ☐ F |
| 16 | R1 | Check where you land | Account created, signed in, and sent to `/student` | | 0:10 | ☐ P ☐ F |
| 17 | R5 | Look at the new student's dashboard | Empty-state guidance; Generate question disabled | | 0:10 | ☐ P ☐ F |
| 18 | D4 | Same page | Friendly guidance, not a blank page | | 0:10 | ☐ P ☐ F |
| 19 | X5 | Look at Log an attempt | The Topic list and Save attempt are disabled | | 0:10 | ☐ P ☐ F |
| 20 | W34 | **Double-click** Log out | One clean return to `/login`; no error | | 0:10 | ☐ P ☐ F |
| 21 | O1 | (Result of the logout above) | On the sign-in page | | 0:10 | ☐ P ☐ F |
| 22 | O2 | Press the browser **Back** button | No dashboard data; sent to `/login` | | | ☐ P ☐ F |
| 23 | O3 | Type `localhost:5173/student` | Redirects to `/login` | | | ☐ P ☐ F |

## 4. Ava (student): sign-in, dashboard, attempts

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 24 | W27 | Enter Ava's details and **double-click** Sign in | One `POST /api/auth/login` in Network; one redirect | | | ☐ P ☐ F |
| 25 | L7 | Watch the button while signing in | Shows "Signing in…" and is disabled | | | ☐ P ☐ F |
| 26 | L2 | Check where you land | `/student` | | 0:40 | ☐ P ☐ F |
| 27 | X15 | DevTools → Application → Cookies; then run `document.cookie` in the Console | `acuity_session` is HttpOnly and SameSite Strict, expiring about 8 hours from now; not in `document.cookie` | | | ☐ P ☐ F |
| 28 | D1 | Look at Your mastery | Topics grouped by subject with coloured, labelled levels | | 0:55 | ☐ P ☐ F |
| 29 | D2 | Read the summary band | Counts such as "N topics mastered, N need practice · N developing" | | 0:55 | ☐ P ☐ F |
| 30 | A4 | Review every row | Only Ava's 8 topics | | | ☐ P ☐ F |
| 31 | M2 | Find a topic at 80% or more with 3+ attempts | Labelled Mastered | | | ☐ P ☐ F |
| 32 | M3 | Find a topic at 60–79% | Labelled Developing | | | ☐ P ☐ F |
| 33 | M4 | Find a topic below 60% | Labelled Needs Practice | | | ☐ P ☐ F |
| 34 | M5 | Find the topic with fewer than 3 attempts | Labelled Not enough data | | | ☐ P ☐ F |
| 35 | X2 | Compare the TOP PRIORITY card with the tables | The lowest-accuracy Needs Practice topic | | | ☐ P ☐ F |
| 36 | X1 | Change the chart's Topic dropdown | The chart and summary sentence switch topic | | 0:55 | ☐ P ☐ F |
| 37 | O4 | Press **F5** | Still signed in on `/student` | | | ☐ P ☐ F |
| 38 | W25 | Open `/student/-1`, then `/tutor/abc`, then `/student?id=' OR 1=1 --` | Each returns to `/student`; no blank page and no other user's data | | | ☐ P ☐ F |
| 39 | A1 | Open `localhost:5173/tutor` | Redirected to `/student` | | 2:55 | ☐ P ☐ F |
| 40 | X3 | Log an attempt: choose a topic, **Correct**, Save attempt | "Saved. … after N attempts."; that row's count goes up by 1 | | 1:50 | ☐ P ☐ F |
| 41 | X4 | Select **Incorrect**, then Save attempt | Incorrect shows selected; the row's accuracy drops | | 1:50 | ☐ P ☐ F |
| 42 | W29 | **Double-click** Save attempt | The row's attempt count goes up by exactly 1 | | | ☐ P ☐ F |
| 43 | M8 | Log attempts on the Not enough data topic until it has 3 | Its label changes from Not enough data to a level | | | ☐ P ☐ F |
| 44 | X23 | In Prisma Studio, note one QuizAttempt row, log an attempt, then refresh Studio | One new row; the noted row is unchanged | | | ☐ P ☐ F |
| 45 | D3 | Reload the page (**F5**) and view the chart for that topic | The chart shows the new attempts (it refreshes on reload, not instantly) | | | ☐ P ☐ F |

## 5. Ava: AI practice (uses Gemini: Q1–Q3)

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 46 | W32 | With Network open, **double-click** Generate question | One `POST /api/student/practice-questions`; one question shown | Q1 | | ☐ P ☐ F |
| 47 | P1 | (Same) | "Creating…", then a question with 4 options and the AI label | Q1 | 1:15 | ☐ P ☐ F |
| 48 | P2 | Compare its topic with the TOP PRIORITY card | Same topic as Ava's weakest | Q1 | | ☐ P ☐ F |
| 49 | P3 | Check the difficulty tag | Needs Practice → Easy (Developing → Medium, Mastered → Hard) | Q1 | | ☐ P ☐ F |
| 50 | A5 | Inspect every Network request and response from the generate call | No Gemini API key anywhere | Q1 | | ☐ P ☐ F |
| 51 | P6 | Try Check answer before choosing | The button is disabled | 0 | | ☐ P ☐ F |
| 52 | W30 | Choose an option, then **double-click** Check answer | One answer request is accepted | 0 | | ☐ P ☐ F |
| 53 | P7 | In Prisma Studio, filter QuizAttempt by this question | Exactly one PRACTICE attempt | 0 | | ☐ P ☐ F |
| 54 | P4 | (If you chose correctly) | "Correct", with the answer and explanation | 0 | 1:15 | ☐ P ☐ F |
| 55 | M6 | (If correct) Check the feedback and the topic row | The topic's score rises | 0 | 1:15 | ☐ P ☐ F |
| 56 | P9 | In Prisma Studio, check PracticeQuestion and QuizAttempt | Question stored with choices, answer, explanation, difficulty, and model; PRACTICE attempt linked | 0 | | ☐ P ☐ F |
| 57 | P5 | Click **New question** and choose a wrong option | "Not quite", the correct answer, and the explanation | Q2 | 1:15 | ☐ P ☐ F |
| 58 | M7 | Check the feedback and the topic row | The topic's score drops | Q2 | 1:15 | ☐ P ☐ F |
| 59 | P8 | Click **New question** once more and compare all 3 | Each question is different | Q3 | | ☐ P ☐ F |
| 60 | B5 | DevTools → Cookies → delete `acuity_session`, then click New question | Sent to `/login` with "Your session has expired, please sign in again." (no Gemini call: the server rejects first) | 0 | | ☐ P ☐ F |
| 61 | B9 | Sign in as Ava again, log out, and view `/login` | The expired message is gone | | 2:20 | ☐ P ☐ F |
| 62 | B6 | Sign in as Ava, delete the cookie, then click Save attempt | Sent to `/login` with the expired message; no attempt saved (check Studio) | | 2:05 | ☐ P ☐ F |
| 63 | B1 | Set `acuity_session` to an expired token (command in TEST_CHECKLIST, "Expired token") and reload | Sign-in page shows "Your session has expired, please sign in again." | | | ☐ P ☐ F |

## 6. Noah and Mia (uses Gemini: Q4–Q5)

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 64 | P10 | Sign in as Noah and click Generate question | The question matches Noah's own TOP PRIORITY topic | Q4 | | ☐ P ☐ F |
| 65 | RAI15 | Sign in as Mia, generate one question, then review all 5 questions (Q1–Q5) | Age-appropriate, on topic, neutral contexts, correct answer key, helpful explanation; note the difficulties seen (all students have Needs Practice topics, so expect mostly Easy) | Q5 | | ☐ P ☐ F |

## 7. Tutor (uses Gemini: S1–S4)

Before row 73: in Prisma Studio, set Noah's Student `displayName` to `<script>alert(1)</script>`. Before row 76: add a TutorStudent row linking the tutor to the student you registered in section 3.

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 66 | L1 | Sign in as the tutor | Redirects to `/tutor` | | 2:20 | ☐ P ☐ F |
| 67 | A2 | Open `localhost:5173/student` | Redirected to `/tutor` | | | ☐ P ☐ F |
| 68 | U1 | Look at Student overview | All 6 seeded students, with weak topics | | 2:20 | ☐ P ☐ F |
| 69 | U2 | Look at Topics needing attention | Class-wide ranking displays correctly | | 2:20 | ☐ P ☐ F |
| 70 | U4 | Find Ava's row | Her scores include the attempts logged in sections 4–5 | | | ☐ P ☐ F |
| 71 | U3 | Click **Ava Chen** | Full topic breakdown and progress chart | | 2:20 | ☐ P ☐ F |
| 72 | X8 | Click **Ava Chen** again | The detail collapses | | | ☐ P ☐ F |
| 73 | W33 | With Network open, **double-click** Generate summary on Ava | One summary request | S1 | | ☐ P ☐ F |
| 74 | T1 | (Same) | "Writing summary…", then at most 3 sentences under Suggested next steps | S1 | 2:20 | ☐ P ☐ F |
| 75 | T2 | Compare it with Ava's scores | It names her actual weak topics | S1 | 2:20 | ☐ P ☐ F |
| 76 | W18 | Reload; generate a summary for the student shown as `<script>alert(1)</script>` (Noah) | No alert; the literal text is shown; the summary is generated normally. Then restore Noah's name. | S2 | | ☐ P ☐ F |
| 77 | T3 | Generate a summary for Liam and compare it with Ava's and Noah's | Each summary is specific to that student | S3 | | ☐ P ☐ F |
| 78 | RAI16 | Review the 3 summaries (Ava, Noah, Liam) | Suggestions ("Consider…"), about topics not the student, Not enough data treated as needing evidence, no new scores | 0 | | ☐ P ☐ F |
| 79 | T4 | Generate a summary for the linked student with no attempts | Says more data is needed; invents no weaknesses | S4 | | ☐ P ☐ F |
| 80 | B7 | Delete `acuity_session`, then click a student name | Sent to `/login` with the expired message | 0 | | ☐ P ☐ F |

## 8. Error tests

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 81 | E4 | Stop `npm run dev` (**Ctrl + C**), then try to sign in | "We could not reach the server. Check your connection and try again." | | | ☐ P ☐ F |
| 82 | S5 | Start `npm run dev` again and sign in as Ava | All earlier data and new attempts are still there | | | ☐ P ☐ F |
| 83 | B10 | Add `throw new Error('test')` as the first line of `ProgressChart` in `client/src/App.tsx`, then open `/student` | "Something went wrong." page with Reload page and Go to home; the word "test" isn't shown; the Console logs it | | | ☐ P ☐ F |
| 84 | W35 | **Double-click** Reload page | Reloads once and shows the fallback again; no other error | | | ☐ P ☐ F |
| 85 | B11 | **Ctrl + Shift + M** → iPhone SE on the same page; then remove the `throw` line | The fallback is centred and readable; no sideways scroll | | | ☐ P ☐ F |

## 9. Phone and tablet view (DevTools device mode, **Ctrl + Shift + M**)

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 86 | V2 | iPhone SE: sign in as Ava | The form is usable and buttons are easy to tap | | | ☐ P ☐ F |
| 87 | V1 | Scroll every section of `/student` | No sideways page scrolling | | 3:45 | ☐ P ☐ F |
| 88 | V3 | Same page | Readable; cards stack vertically | | 3:45 | ☐ P ☐ F |
| 89 | V4 | Sign in as the tutor at iPhone SE size | Tables scroll inside their own panel | | | ☐ P ☐ F |
| 90 | V5 | Switch to an iPad size and view both dashboards | The layout adjusts cleanly | | | ☐ P ☐ F |

## 10. Zoom and screen reader

The keyboard-only cases (AX1–AX3, AX11, AX12) already have recorded passes. The video's keyboard segment (3:25) demonstrates them again.

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 91 | AX8 | Exit device mode; at **Ctrl + +** 200%, view `/login`, `/student`, and `/tutor` | Nothing cut off; no sideways page scroll (wide tables scroll in their own region) | | | ☐ P ☐ F |
| 92 | AX4 | Turn on Narrator (**Win + Ctrl + Enter**); on `/login`, submit empty, then use a wrong password; then trigger the expired message as in B5 | The error summary, each field's error, the server error, and the session notice are all read out | | | ☐ P ☐ F |

## 11. Documentation review

| # | ID | Step | Expected | AI | Video | Pass/Fail |
|---|---|---|---|---|---|---|
| 93 | G2 | Follow the README setup from the top on a clean checkout (or read it through carefully) | Steps are accurate and complete | | | ☐ P ☐ F |
| 94 | G3 | Compare the README env table and both `.env.example` files with `server/.env` | Every variable is listed with a placeholder | | | ☐ P ☐ F |
| 95 | G4 | Open `docs/DEV_LOG.md` and `docs/IMPROVEMENT_LOG.md` | Every phase has timestamped entries; fixes have commit hashes | | | ☐ P ☐ F |

---

## Also check on screen: the 14 "Pass (API)" cases

These passed at the API level but still need a look in the browser. Most fit into the sections above:
- **W1–W3:** the register inputs stop at 80, 254, and 72 characters (section 3).
- **W6:** register with the name `Ava 🚀📚`; the header shows it correctly (section 3).
- **W9, W10, W13, W19:** inline messages for a spaces-only name, a spaces-only email, `' OR 1=1 --`, and `<script>…@x.com` (sections 2–3).
- **W17:** register with the name `<script>alert(1)</script>`; no alert, and the header shows the literal text (section 3).
- **B3:** change one character of `acuity_session` and reload; you land on the sign-in page, no crash (section 5).
- **E1, E2:** the friendly AI error on the page with a bad or missing Gemini key. This needs a server restart with an edited `server/.env`; restore the key afterwards.
- **E3, B13:** with PostgreSQL stopped, sign-in shows "The database is temporarily unavailable…". The video covers this at 3:05.

## After the run
1. In Prisma Studio, restore Noah's name and delete the TutorStudent link you added and the test student accounts. Keep or delete the test QuestionReport rows.
2. Run `npm run db:seed` to restore the baseline.
3. Copy each result into the TEST_CHECKLIST Pass/Fail column. For a failure, note what you did and what happened.
