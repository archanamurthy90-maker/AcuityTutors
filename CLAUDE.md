# Acuity Tutors Project Rules

## Product
Acuity Tutors helps tutoring centers identify student topic gaps, focus practice, and track mastery over time. The primary roles are students and tutors. Tutor roster summaries must make weak topics and progress easy to scan.

## Proposed Stack and Architecture
- Use React + Vite for the frontend and Node.js + Express for the API.
- Use PostgreSQL through Prisma for durable relational storage. Local development uses Docker Compose; production is intended for Google Cloud Run with Cloud SQL.
- Keep Gemini API calls on the server. Never expose provider keys or privileged prompts to the browser.
- Express serves the compiled Vite frontend in production; keep API routes under `/api`.
- Use JWT authentication with password hashes, role-based authorization, and server-side input validation.
- Keep mastery scoring deterministic and testable. Treat generated summaries and questions as AI outputs, not as authoritative persisted mastery calculations.

## Data and Behavior
- Preserve historical quiz-attempt records. Recompute topic mastery from attempt history using a documented, tested scoring rule.
- A tutor can access only their own roster. A student can access only their own history and practice.
- Store generated practice questions and their explanations so a session can be reviewed later.
- Use Prisma schema migrations for database changes. Do not rely on destructive schema synchronization for shared or production environments.
- Add indexes and foreign keys for common roster, student-history, topic, and recency queries.

## Engineering Rules
- Keep frontend, backend, and shared types organized by responsibility; validate all API inputs at the server boundary.
- Put secrets in environment variables and commit only a documented `.env.example` with placeholders.
- Add focused tests for authentication/authorization, mastery scoring, and AI response validation.
- Handle missing Gemini configuration and provider failures with useful, non-sensitive errors.
- Keep changes scoped, follow existing formatting, and update setup documentation when commands or configuration change.
- Do not claim Cloud Run or Cloud SQL deployment is configured until it has been verified.

## Proposed Project Structure
```text
.
|-- client/                  # React + Vite application
|   |-- src/
|       |-- app/
|       |-- components/
|       |-- features/
|       |-- lib/
|-- server/                  # Express API and domain logic
|   |-- src/
|       |-- middleware/
|       |-- routes/
|       |-- services/
|       |-- validation/
|   |-- tests/
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|-- docs/
|   |-- DEV_LOG.md
|-- docker-compose.yml
|-- .env.example
|-- package.json             # Workspace scripts
|-- README.md
|-- CLAUDE.md
```

This structure was approved on 2026-09-30 and is the initial project baseline. Keep later changes scoped and discuss material architecture changes before implementing them.

## Development Log
Record work in `docs/DEV_LOG.md` with a timestamp, prompt/task, actions or changes, errors, and time spent. Distinguish measured time from estimates; do not invent elapsed time.
