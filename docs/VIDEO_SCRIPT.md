# Demo Video Script: Acuity Tutors (about 4 minutes)

**Gemini budget:** this script uses **2 practice questions and 1 tutor summary**, leaving 1 spare question for a retake. Don't generate anything while rehearsing. Rehearse those steps by talking through them, or let a 429 happen: "The AI tutor is receiving many requests…" is a valid error state to show.

**Accounts:** tutor `tutor@acuity.local` / `TutorDemo!2026`, student `ava@acuity.local` / `StudentDemo!2026`.

---

## Before recording

**App and data**
1. Wait until the Gemini daily quota has reset (the free tier allows 20 requests per day). Don't spend calls checking.
2. In PowerShell at the project root, run `npm run db:seed` for a clean demo baseline.
3. Start (or restart) the app with `npm run dev`. Restarting also clears the in-memory rate-limit counters. Repeated wrong-password rehearsals lock an email for 15 minutes after 10 failures, so restart right before you record.
4. Pick a fresh email for the new student, for example `demo.student1@example.com`. In Prisma Studio (`npm run db:studio`), delete any demo accounts left from earlier takes.

**Browser (Edge)**
1. Open `http://localhost:5173/login` in one tab only. Use a 1280×800 window at 100–110% zoom, and hide the favorites bar.
2. Open DevTools (**F12**), dock it to the bottom, then close it. You'll reopen it for the cookie, console and phone-view steps.
3. Copy this console line to the clipboard so it's ready to paste:
   ```js
   fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'}).then(r=>{console.log('Status',r.status);return r.json()}).then(console.log)
   ```

**Windows**
1. Open a second PowerShell window **as Administrator** with these two commands ready: `Stop-Service postgresql-x64-18` and `Start-Service postgresql-x64-18`.
2. Turn on Do Not Disturb, and close chat and email apps.
3. Start the recorder: **Win + Alt + R** (Xbox Game Bar), Clipchamp, or OBS. Check your microphone.

---

## Script

### 0:00–0:10 · Introduction
**Do:** show the sign-in page.
**Say:** "This is Acuity Tutors. It helps tutoring centers find students' weak topics, give them focused practice, and track mastery. In this demo I'll show testing, security, accessibility, and responsible-AI work."

### 0:10–0:40 · Register: validation, duplicate email, student only
**Do:**
1. Click **Create an account**. Point to the note under Full name: "This creates a student account. Tutor access is set up by Acuity Tutors."
2. Type the name `Demo Student`, the email `demo-student`, and the password `123`. Click **Create account**. Errors appear under the email and the password ("Use at least 8 characters, including a letter and a number."), and focus jumps to Email.
3. Change the email to `ava@acuity.local` and the password to `Demo2026x`. Submit. You get "An account with this email already exists."
4. Change the email to your fresh demo email and submit. You land on the student dashboard with empty-state guidance.
5. Click **Log out**.

**Say:** "Registration checks each field and puts the error right next to it. Passwords need 8 characters with a letter and a number, and the server enforces the same rule. There's no Tutor option any more: public sign-up creates students only. That was a security fix, because anyone used to be able to register as a tutor."

### 0:40–0:55 · Login: wrong password, then Ava
**Do:** enter `ava@acuity.local` with the password `WrongPass1` and click **Sign in**. You get "Email or password is incorrect." Then enter `StudentDemo!2026` and sign in.
**Say:** "A wrong password gets a generic message, so nobody can tell which emails have accounts. Sign-in is also rate-limited: after 10 failed attempts the account is paused for 15 minutes."

### 0:55–1:15 · Student dashboard, mastery explanation, progress chart
**Do:**
1. Scroll over the summary band and the subject tables.
2. Point to **How your mastery is calculated**.
3. Scroll to **Accuracy over time**, change the **Topic** dropdown, and point to the summary sentence above the chart.

**Say:** "Mastery is correct answers divided by total attempts: 80% or more is Mastered, 60 to 79 is Developing, below 60 is Needs Practice, and fewer than three attempts is Not enough data. It's a fixed, tested rule, not an AI judgement. The chart also has a text summary and a hidden data table for screen-reader users."

### 1:15–1:50 · AI question: label, answer, explanation, report *(Gemini question 1)*
**Do:**
1. Click **Generate question**. Point to the **AI** badge: "AI-generated question — may contain mistakes."
2. Choose an option and click **Check answer**. Point to Correct / Not quite, the explanation with its AI label, and the line "Mastery is now …%".
3. Click **Report this question**, type `Demo: checking the answer key`, and click **Send report**. The confirmation reads "Thanks — this question has been reported. Your tutor will review it."

**Say:** "Gemini writes the question for my weakest topic, and it's clearly labelled as AI-generated. The app grades my answer on the server, and the mastery update comes from the rule, not the AI. If a question looks wrong, I can report it, and my tutor will see it. Gemini only ever receives topic and score data, never names or emails."

### 1:50–2:05 · Log an attempt (Correct, then Incorrect)
**Do:** in **Log an attempt**, choose a topic, select **Correct**, and click **Save attempt**. Then select **Incorrect** and click **Save attempt** again. Point to "Saved. … after N attempts" and the updated row.
**Say:** "Logged quiz results are stored as history and never overwritten. The topic's score is recalculated from that history each time."

### 2:05–2:20 · Session expired
**Do:**
1. Open DevTools (**F12**) → **Application** → **Cookies** → `http://localhost:5173`. Select `acuity_session` and press **Delete**.
2. Close DevTools and click **Save attempt**. You land on sign-in with "Your session has expired, please sign in again."

**Say:** "If the session expires, the next request signs me out with a clear message instead of leaving a broken page."

### 2:20–2:55 · Tutor: roster, detail, suggested next steps, reported questions *(1 Gemini summary)*
**Do:**
1. Sign in as `tutor@acuity.local` / `TutorDemo!2026`.
2. Point to **Topics needing attention**, then **Reported AI questions**. Ava's report shows her reason, the options with "(marked correct)", and the AI explanation.
3. In **Student overview**, click **Ava Chen** to show the full topic breakdown and chart.
4. Click **Generate summary**. Point to "Suggested next steps" and "You make the final decision about this student's plan."
5. Click **Log out**.

**Say:** "Tutors see only their own roster. The question Ava reported is here with its answer key, so I can check it. The AI summary is worded as suggestions: the tutor decides, not the AI."

### 2:55–3:05 · Ava can't open the tutor page
**Do:** sign in as Ava, then type `localhost:5173/tutor` in the address bar. You're sent back to `/student`.
**Say:** "Roles are enforced. Ava is redirected, and the server would reject the request with 403 anyway. Students can't see other students' data even by changing IDs; automated tests check that."

### 3:05–3:25 · Error handling: bad JSON and a database outage
**Do:**
1. Press **F12** → **Console**, paste the prepared line, and press **Enter**. It shows `Status 400` and "The request body is not valid JSON. Check the data and try again."
2. Click **Log out**. In the admin PowerShell, run `Stop-Service postgresql-x64-18`.
3. Sign in as Ava. You see "The database is temporarily unavailable. Please try again in a moment."
4. Run `Start-Service postgresql-x64-18`.

**Say:** "Bad input gets a clear 400, and a database outage gets a friendly 503 message. No stack traces or internal details are ever sent to the browser."

### 3:25–3:45 · Keyboard only: login and practice *(Gemini question 2)*
**Do:** keep your hands off the mouse.
1. Reload the sign-in page and press **Tab**. "Skip to main content" appears. Press **Enter**, then **Tab** to Email.
2. Type Ava's email, press **Tab**, type the password, and press **Enter**.
3. Press **Tab** until **Generate question** has the green focus outline, then press **Enter**. Focus moves to the question.
4. Press **Tab** into the options, choose one with **↓**, then **Tab** to **Check answer** and press **Enter**. Focus moves to the feedback.

**Say:** "Everything works from the keyboard. There's a skip link, a visible focus outline on every control, and focus moves to the new question and then to the feedback. Automated axe checks found no WCAG violations."

### 3:45–3:55 · Phone view
**Do:** press **F12**, then **Ctrl + Shift + M**, and choose **iPhone SE**. Scroll the dashboard. Cards stack, and the tables scroll inside their own panel. Close DevTools.
**Say:** "On a phone-sized screen the layout stacks, with no sideways page scrolling."

### 3:55–4:00 · Close
**Say:** "Behind this demo are 89 automated tests, a 192-case test checklist, a 32-finding security audit, and a responsible-AI review — all documented in the repository. Thanks for watching."

---

## After recording
1. Run `Start-Service postgresql-x64-18`, if it's not already running.
2. In Prisma Studio, delete the demo student account. Then delete the demo `QuestionReport` row, or keep it as evidence.
3. Run `npm run db:seed` to restore the baseline attempts and scores.

## If something goes wrong
- **"The AI tutor is receiving many requests…"**: the Gemini quota has run out. Keep recording and say: "This is the friendly rate-limit message. The daily AI quota is used up, and the app explains that instead of failing."
- **"Too many sign-in attempts…"**: restart `npm run dev` to clear the in-memory limits, then sign in again.
- **Registration says the account already exists**: use a new demo email for the next take.
