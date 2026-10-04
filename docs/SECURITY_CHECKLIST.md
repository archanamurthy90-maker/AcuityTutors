# Security Checklist — Acuity Tutors

A reusable control checklist. Re-run it before each release or deployment, and after any change to authentication, routes, AI prompts, or configuration. Findings and rationale are in [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Status is as of 2026-10-04 (Phase 4).

**Automated checks:** `npm test` (includes `server/tests/security.test.ts`), `npm run test:api --workspace=server` (with the API running; afterwards run `npm run db:seed`), and `npm audit`.

| # | Area | Control | Status | How to check | Audit ID |
|---|---|---|---|---|---|
| 1 | Sessions | `JWT_SECRET` is ≥32 random characters, not the example placeholder, and stored only in `server/.env` or Secret Manager | ✅ | Missing or short secret → login 503 | SEC-01 |
| 2 | Sessions | JWT is HS256 with issuer, audience, and 8-hour expiry checked; claims are only `sub` and `role` | ✅ | `auth.test.ts`, `security.test.ts` | SEC-02, SEC-04 |
| 3 | Sessions | Session cookie is HttpOnly, SameSite=Strict, and Secure in production | ✅ | DevTools → Cookies; `Set-Cookie` header | SEC-03 |
| 4 | Sessions | Expired or tampered tokens return 401 with a code and clear the cookie | ✅ | Checklist B2, B3 | SEC-02 |
| 5 | Passwords | bcrypt cost 12; registration requires 8–72 bytes with a letter and a number | ✅ | `auth.test.ts`, `security.test.ts` | SEC-06–08 |
| 6 | Passwords | Login takes similar time for unknown and known emails; the error message is generic | ✅ | Compare `curl -w %{time_total}` for both | SEC-09 |
| 7 | Accounts | Public registration creates students only; `role: TUTOR` → 403 | ✅ | `security.test.ts`, `register.test.tsx`, live SEC3 | SEC-23 |
| 8 | Accounts | Demo seed refuses to run with `NODE_ENV=production` (unless `ALLOW_DEMO_SEED=true`) | ✅ | Run the seed with `NODE_ENV=production` | SEC-13 |
| 9 | Accounts | No unexpected tutor accounts exist | ⚠️ 1 self-registered tutor from before the fix | Prisma Studio → User where role = TUTOR | SEC-32 |
| 10 | Secrets | `.env` files are git-ignored; examples contain placeholders only | ✅ | `git status`; read the `.env.example` files | SEC-11 |
| 11 | Secrets | No secrets in git history | ✅ | `git log --all -p \| grep -E "AIza[0-9A-Za-z_-]{20,}"` | SEC-12 |
| 12 | Secrets | Gemini key is server-only and absent from the client bundle | ✅ | `grep -l "AIza\|GEMINI" client/dist/assets/*.js` | SEC-11 |
| 13 | Injection | No raw or string-built SQL (`$queryRawUnsafe`, `$executeRawUnsafe`, interpolated `$queryRaw`) | ✅ | `grep -rn "queryRaw\|executeRaw" server/src` | SEC-14 |
| 14 | Injection | No `dangerouslySetInnerHTML`, `innerHTML`, or `eval` in the client | ✅ | `grep -rn "dangerouslySetInnerHTML\|innerHTML\|eval(" client/src` | SEC-15 |
| 15 | Injection | No user-written text in Gemini prompts; AI output is schema-validated and rendered as text | ✅ | Review `server/src/services/gemini.ts` | SEC-21 |
| 16 | Access | Every protected route uses `requireAuth` + `requireRole` | ✅ | `grep -n "router\.\(get\|post\)" server/src/routes/*.ts` | SEC-17 |
| 17 | Access | Student data is scoped by the session user; tutor data by a `TutorStudent` roster link; foreign IDs → 404 | ✅ | `security.test.ts` IDOR tests; checklist X9, W24 | SEC-16 |
| 18 | Access | A practice question can be answered only once (unique constraint + 409) | ✅ | `practice-answer.test.ts`; checklist W31 | SEC-29 |
| 19 | Validation | Every route validates params and body with Zod; IDs are CUIDs; JSON bodies ≤100 KB | ✅ | Checklist X6, X7, W1–W26, B14 | SEC-18 |
| 20 | Errors | Clients see only friendly messages (400/401/403/404/409/413/429/503/500), never stacks or internal details | ✅ | `errors.test.ts`; checklist B12–B15 | SEC-19 |
| 21 | Errors | Production logs record only error name, code, method, and route | ✅ | `security.test.ts` log test | SEC-20 |
| 22 | Errors | Gemini provider errors map to friendly 429/503/504/502 by status | ✅ | `gemini.test.ts` BUG-07 test | SEC-30 |
| 23 | Abuse | Rate limits: login (10 failures per IP + email, 100 per IP / 15 min), register (20 accounts per IP / hour), practice (20 per student / 10 min), summaries (30 per tutor / 10 min) → friendly 429 | ✅ | `security.test.ts`; live SEC2 | SEC-22 |
| 24 | Abuse | `trust proxy` is set in production so limits use the real client IP | ✅ | `server/src/app.ts` | SEC-22 |
| 25 | Abuse | Rate-limit store is shared if running more than one instance | ⚠️ Accepted: in-memory, single instance | Revisit when deploying | SEC-31 |
| 26 | Headers | helmet: CSP without `unsafe-inline`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS; no `X-Powered-By` | ✅ | `curl -I localhost:3001/api/health`; `security.test.ts` | SEC-24 |
| 27 | Headers | The production build runs under the CSP with no violations (login, student dashboard and chart, tutor dashboard and chart) | ✅ | Headless/real browser console on `NODE_ENV=production` (checklist SEC15) | SEC-24 |
| 28 | Browser policy | CORS allows only `CLIENT_ORIGIN` (or same host); foreign-origin writes → 403 | ✅ | `security.test.ts`; live SEC8 | SEC-26, SEC-27 |
| 29 | Disclosure | Production `/api/health` returns only `{"status":"ok"}` | ✅ | `security.test.ts`; checklist SEC1 | SEC-25 |
| 30 | Dependencies | `npm audit` reports 0 vulnerabilities | ✅ | `npm audit` | SEC-28 |
| 31 | Sessions | Server-side session revocation | ⚠️ Accepted: stateless JWT, 8-hour expiry | Revisit if accounts can be disabled | SEC-05 |
| 32 | Deployment | Tutor provisioning path exists for production | ⚠️ Open: decide before deploying | — | SEC-32 |
