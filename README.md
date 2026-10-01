# Acuity Tutors

A full-stack tutoring-center application foundation for focused practice and durable student progress tracking.

## Stack

- React 19 + Vite + TypeScript (`client/`)
- Node.js + Express + TypeScript (`server/`)
- PostgreSQL + Prisma (`prisma/`)
- Docker Compose for local PostgreSQL
- Gemini is reserved for server-side question generation and tutor summaries; no Gemini integration is implemented yet.

## Prerequisites

- Node.js 20.19+ (Node 22+ recommended)
- npm 10+
- Docker Desktop with Docker Compose, when running PostgreSQL locally

## Local development

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item client/.env.example client/.env
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

Open the Vite client at `http://localhost:5173`. The client proxies `/api` requests to the Express server at `http://localhost:3001`. The initial API endpoint is `GET /api/health`.

If Docker is unavailable, `npm run dev` still starts the client and health API, but the PostgreSQL-backed product features are not available yet. The health page reports whether database and Gemini environment variables are configured; it does not test database connectivity.

To stop the database, run `docker compose down`. Persistent local data is stored in the `acuity_postgres_data` volume. To remove that data as well, explicitly run `docker compose down -v`.

## Commands

- `npm run dev` starts the Vite client and Express API.
- `npm run build` type-checks and builds both workspaces.
- `npm start` serves the production client build and API from Express (build the client first).
- `npm run db:generate` generates the Prisma client.
- `npm run db:migrate -- --name <migration-name>` creates/applies a development migration.
- `npm run db:deploy` applies committed migrations in a deployment environment.
- `npm run db:studio` opens Prisma Studio.

## Current scaffold boundary

This scaffold includes project structure, the initial relational schema, local database configuration, and service health reporting. Authentication, tutor/student workflows, attempt logging, mastery calculations, Gemini integration, and Cloud deployment are not implemented or configured yet. Mastery must remain a deterministic calculation from append-only attempt history; generated AI content must not be treated as authoritative mastery data.
