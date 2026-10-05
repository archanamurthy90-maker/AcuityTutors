# Testing, Security, and Responsible AI — Report Notes (Assignment 5.4)

Citable facts for the Assignment 5.4 report on Acuity Tutors. Sources: [IMPROVEMENT_LOG.md](IMPROVEMENT_LOG.md), [SECURITY_AUDIT.md](SECURITY_AUDIT.md), [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md), [TEST_CHECKLIST.md](TEST_CHECKLIST.md), [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md), [RESPONSIBLE_AI.md](RESPONSIBLE_AI.md), [DEV_LOG.md](DEV_LOG.md), and git history. All numbers are as of commit `456bc97` (2026-10-04, after BUG-08).

## Git history for Assignment 5.4

17 commits on 2026-10-04 between 15:13 and 21:18 local time (commit timestamps; active working time was not tracked): 12 for Phases 0–6, 3 documentation commits (report notes, video script, manual run sheet), and 2 for BUG-08.

| Phase | Commit | Content |
|---|---|---|
| 0 | `76ba756` | Setup: IMPROVEMENT_LOG.md and the CLAUDE.md logging rule |
| 1 | `5b393fc` (+ `b09e195`) | BUG-01 to BUG-04 error-handling fixes, first client test suite |
| 2 | `b98966d` | FEATURE_INVENTORY.md and TEST_CHECKLIST.md (162 cases) |
| 3 | `f0a7f00` (+ `9523df0`) | API test run (44 cases), BUG-05, BUG-06 |
| 4 | `e11ac76` (+ `9f88375`) | Security audit (32 findings) and fixes, BUG-07, SECURITY_AUDIT.md, SECURITY_CHECKLIST.md |
| 5 | `ee0c56a` (+ `ca02645`) | Accessibility fixes A11Y-01 to A11Y-11 |
| 6 | `97752ae` (+ `6d777c2`) | Responsible AI changes RAI-01 to RAI-07, RESPONSIBLE_AI.md |
| Docs | `fe56a00`, `dd6d34a`, `64e309f` | These report notes, VIDEO_SCRIPT.md, MANUAL_RUN_SHEET.md |
| Fix | `642bcf9` (+ `456bc97`) | BUG-08 progress chart refresh |

The commits in brackets only record the phase's commit hash in IMPROVEMENT_LOG.md.

---

## 1. Testing summary

### Scope
- **Feature inventory:** 49 features in 7 groups. Authentication 10, Student 9, AI 7, Tutor 6, Database 6, Administration 6, and cross-cutting UI/error handling 5. Plus 8 end-to-end user workflows (WF-1 to WF-8).
- **Improvement log:** 37 logged changes. 8 bugs, 11 security fixes, 11 accessibility fixes, and 7 responsible AI changes.

### Original plan vs new checklist

| | Original test plan (2026-10-02) | Assignment 5.4 checklist (TEST_CHECKLIST.md) |
|---|---|---|
| Test cases | 72 | **192** (the 72 originals reused with their IDs, plus 120 new) |
| Sections | 9: setup, auth, role access, mastery, AI, dashboards, errors, mobile, repository | The same 9 plus bug regressions, weird input, accessibility, security, and responsible AI |
| Test types | Not classified | 9 types: Security 45, Functional 36, UI 23, AI 23, API 16, Accessibility 16, Authentication 14, Database 13, Responsive 6 |
| Traceability | None | Every case names a feature ID; a coverage table maps all 49 features to their tests |
| Recorded results | 71 Pass, 1 Fail (R3, fixed in `ee445ff`). The plan's summary counts T2–T4 as passed, but those rows have no result recorded. | See below |
| Automation | None (all manual) | 89 automated tests, plus a live API runner covering 45 cases |

**New cases by group:** 23 inventory gaps (X1–X23), 15 bug regressions (B1–B15), 35 weird-input cases (W1–W35), 16 accessibility (AX1–AX16), 15 security (SEC1–SEC15), and 16 responsible AI (RAI1–RAI16).

**Weird-input cases (W1–W35)** cover:
- very long text
- emoji
- spaces only
- `' OR 1=1 --`
- `<script>alert(1)</script>`
- negative and non-numeric IDs in URLs
- double-clicking every submit button

### Results recorded in Assignment 5.4 (TEST_CHECKLIST.md Pass/Fail column)

| Result | Cases |
|---|---|
| Pass | 68 |
| Pass (API): server side passed; browser display still to check | 14 |
| Pass (automated): covered by automated tests; live browser run pending | 8 |
| Pass (axe): axe-core clean; Lighthouse score not yet recorded | 1 (AX6) |
| Fail → Pass after a fix | 6: W31 (BUG-05), SEC7 (BUG-06), SEC2 (SEC-22), SEC3 (SEC-23), SEC4 (SEC-24), AX9 (A11Y-06) |
| **Total with a passing result** | **97 of 192** |
| Open failures | **0** |
| Not yet run (browser-only manual cases) | 95 |

- Of the 72 reused plan cases, 9 were re-run in this assignment (6 Pass, 3 Pass (API)). The other 63 are browser cases awaiting a fresh manual run against the updated code.
- The manual cases still open include RAI15–RAI16 (content review), AX4 (screen reader), AX8 (200% zoom), and the V1–V5 responsive checks.

### Automated tests

| Suite | Before 5.4 | After 5.4 | Files (test count) |
|---|---|---|---|
| Server (`node:test` via tsx) | 8 | **49** | `security` 18, `reports` 8, `gemini` 7, `auth` 5, `errors` 4, `practice-answer` 3, `mastery` 3, `progress` 1 |
| Client (Vitest + jsdom + Testing Library + axe-core) | 0 | **40** | `a11y` 15, `responsible-ai` 9, `contrast` 5, `session` 4, `api` 3, `ErrorBoundary` 2, `register` 1, `progress-refresh` 1 |
| **Total** | **8** | **89** | |

- **Live API runner:** `server/scripts/api-checklist.ts` (`npm run test:api --workspace=server`) runs 45 API-level checklist cases against the running app. Its last full run before the Gemini quota ran out passed 44 of 45 (W24 failed, which led to BUG-07). The last run with `SKIP_GEMINI=1` passed 39 of 39.
- **Real-browser checks:** headless Edge, driven over the DevTools protocol, against the production build:
  - **CSP (Phase 4):** login, student and tutor dashboards and their charts rendered with 0 CSP violations.
  - **Accessibility (Phase 5):** axe-core reported 0 violations on 5 page states, and a Tab walk recorded 36 focus stops, all with a visible outline.
- **Every phase ended with:** `npm test`, `npm run build`, client lint (oxlint), and `npm audit`. Final state: all pass, **0 vulnerabilities**.

---

## 2. Bugs found and fixed

| ID | Issue | Impact | Fix | Verified by | Commit |
|---|---|---|---|---|---|
| BUG-01 | `/auth/me` treated every bad token the same, and the client ignored the 401 body. | An expired session silently dropped users at sign-in with no explanation. | `requireAuth` returns `SESSION_EXPIRED` / `SESSION_INVALID` / `AUTH_REQUIRED`; the sign-in page shows "Your session has expired, please sign in again." | `auth.test.ts`; `session.test.tsx`; live 401 check | `5b393fc` |
| BUG-02 | Only the first dashboard load reacted to 401; background requests did not sign the user out. | A dead dashboard with stale data and failing actions. | A shared `apiFetch` signs the user out on any protected 401 and shows the expired message. | `api.test.ts`; `session.test.tsx` (fails on the old code) | `5b393fc` |
| BUG-03 | No React error boundary. | Any render crash showed a blank white page. | `ErrorBoundary` with a "Something went wrong." fallback, a Reload button, and a home link. | `ErrorBoundary.test.tsx` | `5b393fc` |
| BUG-04 | Malformed JSON and database outages became generic 500s, with nothing logged. | Clients couldn't tell bad input from outages; failures were invisible. | `middleware/errors.ts`: malformed JSON → 400, oversized body → 413, database unavailable → 503 with a friendly message, server-side logging, no stack in responses. | `errors.test.ts`; live with the database stopped | `5b393fc` |
| BUG-05 | A practice question could be answered repeatedly through the API, including two simultaneous submits (checklist W31). | Extra attempts that inflated or shifted mastery. | Unique database constraint on `QuizAttempt.practiceQuestionId` (migration `20261004160000`) plus 409 "This question has already been answered." | `practice-answer.test.ts`; live: before the fix 201/201 with 2 rows, after 201/409 with 1 row | `f0a7f00` |
| BUG-06 | The sign-in page said passwords were "encrypted" (checklist SEC7). | An inaccurate security claim (bcrypt hashes, it doesn't encrypt). | Now reads "Your password is securely hashed before it is stored." | `session.test.tsx` | `f0a7f00` |
| BUG-07 | Gemini Interactions API errors (`RateLimitError` and other `APIError` subclasses) weren't recognised, so 429, 401/403 and 5xx became a misleading 502. | A rate-limited AI looked like a broken AI; quota exhaustion was hard to diagnose. | Errors are mapped by numeric HTTP status: 429 → 429, 401/403 → 503, ≥500 → 503. | `gemini.test.ts`; live: the quota error now returns 429 with a friendly message | `e11ac76` |
| BUG-08 | The student's progress chart was loaded once at sign-in and only updated after a page reload (checklist D3). | After an attempt or practice answer, the chart and its summary sentence contradicted the updated mastery table. | A refresh counter re-fetches stored progress history after each saved attempt and practice answer; no Gemini call. The tutor's detail view was unaffected. | `progress-refresh.test.tsx` (fails on the old code); browser check of D3 pending | `642bcf9` |

How they were found:
- **BUG-01 to BUG-04:** reported by a previous AI session.
- **BUG-05 and BUG-06:** found while writing the checklist in Phase 2.
- **BUG-07:** found during the Phase 4 test run, when the Gemini quota ran out.
- **BUG-08:** found while writing the manual run sheet, when the expected result for D3 turned out to need a page reload.

---

## 3. Security

**Audit (SECURITY_AUDIT.md):** 32 findings (SEC-01 to SEC-32). 12 fixed, 16 already secure (Pass), 3 accepted residual risks, 1 open owner action. **No Critical findings.**

### Vulnerabilities identified and resolved (12)

| ID | Risk | Vulnerability | Fix |
|---|---|---|---|
| SEC-22 | **High** | No rate limiting on login, registration, or the AI endpoints (brute force, mass sign-up, Gemini quota abuse) | `express-rate-limit`. Login: 10 failures per IP + email and 100 per IP per 15 min. Register: 20 accounts per IP per hour. Practice: 20 per student per 10 min. Summaries: 30 per tutor per 10 min. Friendly 429 responses; `trust proxy` set in production. |
| SEC-23 | **High** | Anyone could self-register as a Tutor (privilege escalation) | The API returns 403 for any role but STUDENT, and the Tutor toggle was removed from the register page. Tutors come from the seed. |
| SEC-07 | Medium | bcrypt only uses the first 72 bytes, but passwords of up to 128 characters were accepted (silent truncation) | Registration passwords limited to 72 UTF-8 bytes on the server and client. |
| SEC-09 | Medium | Unknown emails skipped bcrypt, so their faster response revealed which accounts exist | A dummy bcrypt comparison runs for unknown emails. Measured: 0.89–1.09 s for an unknown email vs 0.79–0.95 s for a real one. |
| SEC-13 | Medium | The demo seed (with publicly documented passwords) could run against production | The seed refuses `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`. |
| SEC-24 | Medium | No security headers | `helmet`: CSP limited to `'self'` with no `unsafe-inline`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, `nosniff`. 0 CSP violations in the browser. |
| SEC-04 | Low | User email included in the JWT payload (readable by anyone holding the cookie) | Claims reduced to `sub` and `role`. |
| SEC-18 | Low | 1 MB JSON body limit, far above any real request | Lowered to 100 KB (413 above that). |
| SEC-20 | Low | Error logs could contain emails echoed in Prisma messages | Production logs record only the error name, code, method and route. |
| SEC-25 | Low | `/api/health` publicly revealed database and Gemini configuration | Production returns only `{"status":"ok"}`. |
| SEC-26 | Low | No explicit CORS allowlist or cross-origin write check | `cors` limited to `CLIENT_ORIGIN` or the same host; foreign-origin writes → 403. |
| SEC-30 | Low | Gemini provider errors misreported (same issue as BUG-07) | Mapped by HTTP status. |

**Fixed by risk level:** High 2, Medium 4, Low 6.

**New automated security tests:** 18 in `security.test.ts`:
- 5 IDOR tests that assert each database query is scoped to the signed-in user or the tutor's roster
- 4 rate-limit tests
- role checks
- tutor registration blocked
- the 72-byte password cap
- JWT claims
- security headers and CSP
- CORS
- the health response
- production log redaction

### Already secure (Pass, 16)

| ID | Area | Why it passed |
|---|---|---|
| SEC-01 | JWT secret strength | Requires ≥32 characters and rejects the example placeholder; auth returns 503 without one. |
| SEC-02 | JWT validation | HS256 pinned; issuer, audience and 8-hour expiry checked. |
| SEC-03 | Cookie flags | HttpOnly, SameSite=Strict, Secure in production. |
| SEC-06 | Password storage | bcrypt cost 12; hashes never returned. |
| SEC-08 | Password rule | 8+ characters with a letter and a number, enforced on the server (R3). |
| SEC-11 | Secret handling | `.env` git-ignored, examples hold placeholders, the Gemini key is server-only, no key in the client bundle. |
| SEC-12 | Git history | No keys or real credentials in any commit. |
| SEC-14 | SQL injection | Prisma query builder only; the single raw query is a tagged `SELECT 1`. |
| SEC-15 | XSS | No `dangerouslySetInnerHTML`, `innerHTML` or `eval`; React escapes all text. |
| SEC-16 | IDOR | Every ID route is scoped by session ownership or roster link; foreign IDs → 404. |
| SEC-17 | Role authorization | `requireAuth` + `requireRole` on every protected route. |
| SEC-19 | Error responses | No stacks or internal details (after BUG-04). |
| SEC-21 | Prompt injection | No user-written text reaches Gemini. |
| SEC-27 | CSRF | SameSite=Strict cookie and JSON-only bodies. |
| SEC-28 | Dependencies | `npm audit`: 0 vulnerabilities. |
| SEC-29 | Answer replay | Fixed earlier as BUG-05. |

### Accepted and open
- **Accepted (3):**
  - SEC-05: stateless JWT, so logout doesn't revoke a copied token before its 8-hour expiry.
  - SEC-10: registration reveals that an email already exists (mitigated by rate limiting).
  - SEC-31: rate-limit counters are per server instance.
- **Open (1), SEC-32:**
  - One tutor account self-registered on 2026-10-02, before the fix, is still in the local database (empty roster).
  - A way to create tutor accounts in production must be decided before deployment.

---

## 4. Accessibility (WCAG 2.1 AA basics)

| ID | Feature added |
|---|---|
| A11Y-01 | "Skip to main content" link as the first Tab stop; `main#main-content` is focusable. |
| A11Y-02 | One high-contrast focus outline on every control: 3 px solid `#2f4a37`, at least 7:1. Replaced faint 22–35% opacity outlines and `outline: none`. |
| A11Y-03 | Contrast fixes. Muted text #737b72 went from 3.9–4.4:1 to #646c63 at ≥4.8:1 on all 13 backgrounds. Coral text 3.9–4.1:1 → 5.1:1. Footer 3.1:1 and password note 3.6:1 now use the muted color. Input borders 1.5:1 → 3.3:1. |
| A11Y-04 | Per-field form errors with `aria-invalid` and `aria-describedby`, an alert summary, focus on the first invalid field, and server errors mapped to their fields. |
| A11Y-05 | A persistent `role="status"` announcer for loading and progress, so screen readers hear "Loading mastery data…", "Creating a practice question…", "Saving attempt…" and similar. |
| A11Y-06 | **AX9:** the accuracy chart now has a text summary and a screen-reader data table; the SVG is hidden from assistive tech and is not a Tab stop. |
| A11Y-07 | Focus moves to the new question after Generate, to the feedback after Check answer, and to the fallback heading after a crash. |
| A11Y-08 | Ordered headings (roster names are h3 disclosure buttons with `aria-expanded` and `aria-controls`); the error fallback keeps its `main` landmark. |
| A11Y-09 | Table captions; wide tables are focusable, named scroll regions. |
| A11Y-10 | Context for repeated buttons ("Ava Chen, show full topic breakdown"; summary buttons described by the student's name). |
| A11Y-11 | A title for each page (Sign in, Create account, Student dashboard, Tutor dashboard). |

Already in place: mastery levels are written as text (not color alone), there are no icon-only buttons, all inputs are labelled, and the answer options are native radio buttons.

**Results**
- axe-core (WCAG 2.1 A/AA + best practice) in headless Edge on the production build: **0 violations** on 5 page states. Color contrast was measured on 20–169 elements per page.
- Tab walk: **36 focus stops recorded, all with a visible outline**. No keyboard traps; the chart is not a Tab stop.
- 20 automated client tests: `a11y.test.tsx` 15 and `contrast.test.ts` 5.

**Lighthouse scores: not yet recorded.** Checklist AX6 is marked "Pass (axe)" because axe-core is the engine Lighthouse uses. Run Lighthouse in Edge DevTools and fill in the table:

| Page | Lighthouse Accessibility (Desktop) | Lighthouse Accessibility (Mobile) |
|---|---|---|
| `/login` | _not recorded_ | _not recorded_ |
| `/register` | _not recorded_ | _not recorded_ |
| `/student` | _not recorded_ | _not recorded_ |
| `/tutor` | _not recorded_ | _not recorded_ |

Still manual: AX4 (Windows Narrator), AX8 (200% zoom), and AX2 in a live browser (blocked by the Gemini quota).

---

## 5. Responsible AI

| ID | Principle | Measure |
|---|---|---|
| RAI-01 | Transparency | An "AI" badge with "AI-generated — may contain mistakes" on every AI question, explanation, tutor summary and reported question. The explanation adds "Your score is calculated by the app, not the AI." |
| RAI-02 | Transparency | "How your mastery is calculated": correct ÷ total; 80%+ Mastered, 60–79% Developing, below 60% Needs Practice, fewer than 3 attempts Not enough data; "a fixed rule, not an AI judgement". |
| RAI-03 | Human oversight / reliability | **Report this question.** Optional reason of up to 300 characters, own questions only (404 otherwise), once per question (409). Stored in `QuestionReport` (migration `20261004170000`). Tutors see only their roster's reports, with the answer key and explanation. |
| RAI-04 | Human oversight | Tutor summaries worded as suggestions under "Suggested next steps", with "You make the final decision about this student's plan." |
| RAI-05 | Privacy | Confirmed only subject, topic, accuracy, mastery level, attempt count and difficulty go to Gemini, never names, emails or IDs. The summary prompt copies only those fields, and requests use `store: false`. |
| RAI-06 | Safety / fairness | System instruction: ages 11–14, age-appropriate, strictly on topic, no stereotypes, no personal data or links, and ignore any instructions inside `<topic_data>`. The data is passed as escaped JSON inside that block. |
| RAI-07 | Safety / reliability | Output containing links, email addresses or HTML is rejected and the safe fallback is used (friendly 502, nothing saved or shown). |

**Evidence**
- **Server:** 8 report tests in `reports.test.ts`, including "a student cannot report another student's question", plus 4 prompt and output tests in `gemini.test.ts`.
- **Client:** 9 tests in `responsible-ai.test.tsx`.
- **Live:** report 201, duplicate 409, another student's question 404, a 301-character reason 400, the tutor list showed the report, and a student calling the tutor list got 403.
- **Checklist:** RAI1–RAI16. 14 have a recorded pass; RAI15–RAI16 (manual content review) are pending until the Gemini quota resets.

**Documented limitation:**
- Tutors can see reports but **cannot yet resolve them, or exclude the reported question's attempt from mastery**. The answer key comes from Gemini, so a wrong key can still affect a student's mastery until this is added (RESPONSIBLE_AI.md §4 and §7).
- Validation checks structure, not factual correctness.
- There is no automated bias evaluation.
- Questions reach students without prior human review.

---

## 6. Challenges

1. **GitHub Copilot credits ran out.** The original test plan lists "VS Code with GitHub Copilot agent mode" as the environment. When the Copilot credits were used up, work moved to Claude Code, continued from a resume prompt. All 12 Assignment 5.4 commits were made in Claude Code.
2. **The disk filled up and broke `node_modules` mid-install** (Phase 1).
   - `npm install -D vitest jsdom @testing-library/react` failed with `ENOSPC` because drive C: had **0 bytes free**. That left `oxlint` missing and `vitest` half-installed, while `package.json` was unchanged.
   - After 0.1 GB was freed by hand, `npm cache clean --force` freed about 1 GB (to 1.10 GB free) and the reinstall succeeded.
   - Low resources came back in Phase 6 (about 216 MB of disk and 1 GB of RAM free). Vitest workers crashed (exit 134 and 0xC0000409), fixed by limiting Vitest to 2 workers with a 30-second test timeout.
3. **The Gemini daily quota ran out during testing** (Phase 4).
   - The provider returned `429 Rate limit exceeded for model gemini-3.8-flash (limit: 20 requests per day on Free Tier). Please retry in 3h49m43s`. That exposed **BUG-07**: the app had reported the error as a misleading 502.
   - Consequences:
     - W24 was changed to reuse a stored question.
     - The API runner gained `SKIP_GEMINI=1`.
     - Live generation checks were left pending: AX2, RAI1–RAI3, and RAI15–RAI16 content review.

**Also encountered**
- Windows locked Prisma's engine file (`EPERM`) during `db:generate` in Phases 3 and 6. Fixed by briefly stopping the dev API process.
- `prisma migrate dev` refused to run non-interactively. Migrations were generated with `prisma migrate diff` and applied with `migrate deploy`.
- Two duplicate DEV_LOG entries were removed and one out-of-order entry moved (Phase 4).

---

## 7. Comparison with App #1 (LeaseLens)

The LeaseLens column describes how App #1 was tested, as stated by the author.

| Practice | App #1: LeaseLens | App #2: Acuity Tutors (Assignment 5.4) |
|---|---|---|
| Functional testing | Informal clicking through the app | 192-case checklist with IDs, feature traceability (49 features) and 9 test types; 97 cases with a recorded pass |
| Automated tests | None | 89 (49 server, 40 client), plus a live API runner covering 45 cases |
| Edge-case / abuse input | Not tested | 35 weird-input cases (long text, emoji, spaces only, SQL injection, script tags, bad URL IDs, double-clicks) |
| Security | No audit | 32-finding audit (12 fixed, 16 pass, 3 accepted, 1 open), 15 SEC checklist cases, 18 automated security tests, `npm audit` clean |
| Accessibility | Not tested | 11 fixes (A11Y-01 to A11Y-11), 16 AX cases, axe-core 0 violations on 5 page states, 20 automated accessibility and contrast tests |
| Responsible AI | No review | 7 measures (RAI-01 to RAI-07), RESPONSIBLE_AI.md covering 6 principles, 16 RAI cases, 21 automated tests (8 report, 4 prompt/output, 9 client) |
| Bug tracking | None | IMPROVEMENT_LOG.md with 37 entries (ID, type, issue, risk, fix, verification, commit) |
| Version control | — | A commit after each phase and fix (17 commits), with each fix linked to its commit |
