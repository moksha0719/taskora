# Taskora Backend

The backend is a Node.js 22 and Express API using PostgreSQL through Prisma.
It provides JWT authentication, task and Study Planner APIs, notifications,
and server-side Gemini-backed Assistant and Brain Dump endpoints. The
notification scheduler runs inside each backend process; notifications are
in-app only. The frontend still uses local mock data and is not connected to
these APIs.

## Requirements

- Node.js 22 LTS and npm for native development.
- PostgreSQL 16, either locally or through the development Compose stack.
- Docker Desktop with Linux containers and the Docker Compose plugin for
  containerized development and image builds.

## Local development

Install dependencies from the repository root:

```bash
npm --prefix backend ci
```

Configure these environment-variable **names** in the backend process
environment. Do not put secret values in documentation, source control, or
frontend variables.

| Name | Requirement |
| --- | --- |
| `DATABASE_URL` | Required by Prisma for database access. |
| `JWT_SECRET` | Required at server startup; must contain at least 32 bytes. |
| `PORT` | Optional; defaults to `5000`. |
| `GEMINI_API_KEY` | Required to use Gemini-backed endpoints; not required for server startup. |
| `GEMINI_MODEL` | Required to use Gemini-backed endpoints; not required for server startup. |
| `CORS_ALLOWED_ORIGINS` | Optional in development; comma-separated exact origins allowed by CORS. In production, configure the deployed frontend origin or browser requests with an `Origin` header are denied. |
| `POSTGRES_USER` | Required by the development Compose file. |
| `POSTGRES_PASSWORD` | Required by the development Compose file. |
| `POSTGRES_DB` | Optional in Compose; defaults to `taskora_db`. |

For a native backend process, `DATABASE_URL` must refer to the local PostgreSQL
instance and a dedicated development database. For Compose, the backend
connects to the `postgres` service; Compose constructs its `DATABASE_URL` from
the PostgreSQL variables above.

Generate Prisma Client, validate the schema, and apply the checked-in migrations
to a local development database:

```bash
cd backend
npm run db:generate
npm run db:validate
npm run db:deploy
```

The `predev` lifecycle regenerates Prisma Client from the current schema before
the development server starts. This keeps persistent Docker dependency volumes
in sync when the Prisma schema changes.

`db:deploy` applies pending migrations; it does not reset the database. Start
the native development server with:

```bash
npm run dev
```

The server listens on port `5000` by default. To run it without nodemon, use
`npm start`.

Run the backend test suite from the repository root or `backend/`:

```bash
npm --prefix backend test
# or, from backend/
npm test
```

The backend tests use mocked dependencies and do not require a live database.

## Docker development

From `backend/`, start the PostgreSQL and backend development services:

```bash
docker compose up --build -d
```

The Compose file builds the Dockerfile's `development` target. PostgreSQL's
`pg_isready` health check must pass before Compose starts the backend. Compose
does not apply migrations automatically. On a new local database, apply them
once with:

```bash
docker compose exec backend npm run db:deploy
```

Check backend readiness at `http://localhost:5000/health/ready`. It returns
`200` when the database accepts a simple query and `503` otherwise. This checks
database connectivity, not whether every migration has been applied. The
liveness endpoint is `http://localhost:5000/health/live`.

Stop and remove the development containers and network while preserving the
PostgreSQL data volume:

```bash
docker compose down
```

Do not add `-v` if you want to keep the named PostgreSQL volume.

## Production deployment

The production Docker target uses the Node 22 slim image, runs
`npm ci --omit=dev` in its runtime dependency stage, copies the generated
Prisma Client plus the schema and migrations, runs as the non-root `node` user,
and starts Node directly. `.dockerignore` excludes environment files, local
dependencies, and common secret files from the build context.

Set `CORS_ALLOWED_ORIGINS` in the production environment to the comma-separated
exact origin or origins from which the deployed browser frontend is served.
Each entry must contain only the scheme, host, and optional port, without a
path or trailing slash. The actual production origin is deployment-specific
and is not defined by this repository. When `NODE_ENV=production`, an absent
or empty allowlist denies requests carrying an `Origin` header; requests with
an unapproved origin receive `403`. Requests without an `Origin` header remain
available for non-browser clients. In local development, an unset allowlist
preserves the current permissive CORS behavior (including the documented Vite
origin at `http://localhost:5173`).

Build the runtime image and the separate one-shot migration image from the
repository root:

```bash
docker build --target production -t taskora-backend:release backend
docker build --target migration -t taskora-backend-migrate:release backend
```

Before any migration, take a database backup or confirm the managed database's
backup/point-in-time recovery is available, and verify that the target
database's Prisma migration history is correct. Run the migration image once
from a release job with the production `DATABASE_URL` supplied securely:

```bash
docker run --rm -e DATABASE_URL taskora-backend-migrate:release
```

This image runs `prisma migrate deploy` using
`backend/prisma/schema.prisma` and its adjacent `backend/prisma/migrations`
directory. Wait for a successful exit before deploying or rolling out
application replicas. **Do not run migrations in each application replica.**
Because `@prisma/client` declares Prisma CLI as a peer dependency, `npm ci
--omit=dev` currently leaves Prisma CLI in the production dependency tree.
The application startup command does not invoke migrations.

Start the application image with `DATABASE_URL` and `JWT_SECRET` injected by
the deployment platform. `GEMINI_API_KEY` and `GEMINI_MODEL` are needed only
when Gemini-backed endpoints are used; `PORT` is optional and defaults to
`5000`. The image's default command is `node src/server.js`; its health check
uses `http://127.0.0.1:5000/health/ready`.

Deployments should also monitor `GET /health/ready` and `GET /health/live`.
The readiness endpoint checks database connectivity only; it is not a
migration-state check. The application process handles `SIGTERM` and
`SIGINT`: it stops the notification scheduler, closes the HTTP server, and
disconnects Prisma. Docker deployments should allow time for this shutdown to
complete.

No production Compose file is provided. The checked-in `docker-compose.yml` is
for development and includes a local PostgreSQL service, development mounts,
and the `development` build target.

## APIs and scheduling

The API base path is `http://localhost:5000`. Protected routes require a JWT
from `POST /api/auth/login` in the `Authorization: Bearer <JWT>` header.
Endpoint contracts, request and response examples, validation, and error
responses are documented in:

- [Backend API Contract](../docs/backend-api-contract.md)
- [Phase 06 Study Planner API Contract](../docs/phase06-api-contract.md)

The current APIs cover authentication, task CRUD, AI Assistant, Brain Dump,
Study Planner, notifications, and health checks. Study schedule generation
at `POST /api/study-plans/generate` returns a preview and does not save it.
Persisting the schedule is a separate
`PUT /api/study-plans/:id/schedule` operation.

The notification scheduler checks due tasks within the next 24 hours and
persisted study sessions 15 minutes before their start. It runs once per minute
and uses database deduplication. It does not recover task or study reminders
that have become overdue while the scheduler was down.

## Troubleshooting and known limitations

- **Docker Desktop engine unavailable:** `docker --version` checks only the
  CLI. If `docker info` reports that it cannot connect to
  `dockerDesktopLinuxEngine`, start Docker Desktop and select the Linux
  container engine, then retry `docker info`.
- **Compose variable interpolation:** Compose requires `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, and `JWT_SECRET`; `POSTGRES_DB` has a default. Configure
  them through the local development environment without committing secret
  values.
- **Database not ready:** Check `/health/ready` and Compose's PostgreSQL
  health. Inside Compose, the database hostname is `postgres`; a native backend
  process uses the hostname appropriate to the local PostgreSQL setup. Verify
  `DATABASE_URL` is supplied to the backend without printing its value.
- **JWT startup failure:** The server fails at startup if `JWT_SECRET` is
  absent or shorter than 32 bytes. Configure an appropriately long value
  through the deployment's secret/environment mechanism.
- **Gemini unavailable:** Verify that `GEMINI_API_KEY` and `GEMINI_MODEL` are
  configured. Missing or invalid Gemini configuration makes AI requests return
  `503`; it does not prevent non-AI server startup.
- **Schema or migration issue:** `npm run db:validate` validates the Prisma
  schema; `npm run db:deploy` applies pending migrations. Do not use reset or
  schema-push commands against production. Check migration history and backups
  before a production rollout.
- **Dependency audit notices:** The latest Docker build reported 3 high
  severity findings in the production dependency install, and 5 findings in
  the development install (2 moderate and 3 high). These warnings have not
  been resolved as part of this documentation update; rerun an audit to refresh
  the findings.

Production deployment has not been tested against a production server or
database.
