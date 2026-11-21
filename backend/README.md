# Taskora Backend

The backend is a Node.js 22 and Express API using PostgreSQL through Prisma.
It provides JWT authentication, task and Study Planner APIs, flashcard decks,
focus sessions, persisted study-room timers, notifications, and server-side
Gemini-backed Assistant and Brain Dump endpoints. The
notification scheduler runs inside each backend process; notifications are
in-app only. The frontend is connected to the authentication, task, study
planner, flashcard, focus, study-room, AI/Brain Dump, notification and product
persistence APIs. Theme and dashboard preferences remain browser-local.

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
| `EMAIL_PROVIDER` | `mock` for non-sending local development, `resend` for Resend API delivery, or `webhook` for the existing custom delivery endpoint. Defaults to `mock` outside production; required in production. |
| `EMAIL_API_KEY` | Required when `EMAIL_PROVIDER=resend`. Store the Resend API key as a backend secret. |
| `EMAIL_FROM` | Required for Resend; sender address verified by the provider. |
| `EMAIL_FROM_NAME` | Required for Resend; defaults to `Taskora` for webhook payloads. |
| `PASSWORD_RESET_URL` | Frontend `/forgot-password` URL. Required for Resend; use the deployed HTTPS URL in production. |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | Optional reset-token lifetime in minutes; defaults to `30`, allowed range is `1`–`1440`. |
| `EMAIL_DELIVERY_TIMEOUT_MS` | Optional provider request timeout in milliseconds; defaults to `5000`, maximum `60000`. |
| `PASSWORD_RESET_DELIVERY_URL` | Required when `EMAIL_PROVIDER=webhook`; HTTPS is required in production. If set without `EMAIL_PROVIDER`, it preserves the legacy webhook selection. |
| `PASSWORD_RESET_DELIVERY_AUTHORIZATION` | Optional custom webhook authorization header value. |
| `PASSWORD_RESET_DELIVERY_SIGNING_SECRET` | Optional HMAC-SHA256 signing secret for reset-delivery payloads. |
| `PASSWORD_RESET_DELIVERY_TIMEOUT_MS` | Legacy alias for `EMAIL_DELIVERY_TIMEOUT_MS`; retained for existing webhook deployments. |
| `CORS_ALLOWED_ORIGINS` | Optional in development; comma-separated exact origins allowed by CORS. In production, configure the deployed frontend origin or browser requests with an `Origin` header are denied. |
| `POSTGRES_USER` | Required by the development Compose file. |
| `POSTGRES_PASSWORD` | Required by the development Compose file. |
| `POSTGRES_DB` | Optional in Compose; defaults to `taskora_db`. |
| `PROFILE_UPLOAD_DIR` | Optional local profile-photo storage directory; defaults to `backend/uploads/profile-photos`. |

For a native backend process, `DATABASE_URL` must refer to the local PostgreSQL
instance and a dedicated development database. For Compose, the backend
connects to the `postgres` service; Compose constructs its `DATABASE_URL` from
the PostgreSQL variables above.

### External service integrations

| Service | Purpose | Configuration/status |
| --- | --- | --- |
| Google Gemini | AI Assistant and Brain Dump processing. | `GEMINI_API_KEY` and `GEMINI_MODEL` are required when those endpoints are used. Requests have a 20-second timeout; missing credentials produce a safe service-unavailable response. |
| Resend email API | Password-reset email delivery. | Optional for local use; configure `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, verified `EMAIL_FROM`, `EMAIL_FROM_NAME`, and `PASSWORD_RESET_URL` to enable real delivery. |
| Custom email webhook | Backward-compatible password-reset handoff to an existing mail service. | Select `EMAIL_PROVIDER=webhook` and configure `PASSWORD_RESET_DELIVERY_URL`; optional authorization and HMAC signing are supported. |
| In-app notifications | Task and study reminders displayed in Taskora. | Persisted in PostgreSQL and scheduled by the backend; email/push delivery is not implemented. |
| File/image storage | Profile photos. | Authenticated JPEG, PNG, and WebP uploads (up to 5 MB) are stored locally and their public URL is saved in `User.avatar`. |
| Email verification | Account verification. | Not implemented; there are no verification emails or verification-token workflows to configure. |
| Redis/pub-sub | Cross-replica study-room events and shared rate limits. | Not currently integrated. Study-room SSE and rate-limit counters are process-local; Redis is not required for a single backend instance. |

No email or Gemini credentials are included in the repository. Automated tests
use mocked transports and never call Resend or Gemini.

### Password-reset email setup

Local development defaults to `EMAIL_PROVIDER=mock`; it does not send an email
and logs a safe delivery status. To use Resend, configure the provider key in
the backend process environment (or a local, untracked `backend/.env`):

```dotenv
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<Resend API key>
EMAIL_FROM=no-reply@your-verified-domain.example
EMAIL_FROM_NAME=Taskora
PASSWORD_RESET_URL=https://your-frontend.example/forgot-password
EMAIL_DELIVERY_TIMEOUT_MS=5000
```

Verify the sender domain and address with the email provider before expecting
delivery. Production startup rejects missing or invalid provider configuration
and requires HTTPS for both the reset URL and webhook delivery. Provider
credentials and reset tokens are never written to logs or API responses.

To keep using a custom mail-delivery webhook, set
`EMAIL_PROVIDER=webhook` and `PASSWORD_RESET_DELIVERY_URL`. The webhook
continues to receive the legacy `email`, `token`, and `expiresAt` fields; when
`PASSWORD_RESET_URL` is configured, it also receives a generated `resetUrl`
and rendered subject/text/HTML content. Optional authorization and HMAC
signatures can authenticate that request. A successful HTTP response only
confirms provider acceptance; it does not prove inbox delivery.

Generate Prisma Client, validate the schema, and apply the checked-in migrations
to a local development database:

```bash
cd backend
npm run db:generate
npm run db:validate
npm run db:deploy
```

To check the configured development database's migration status without
applying migrations, run this from PowerShell in `backend`:

```powershell
.\scripts\check-dev-migration-status.ps1
```

The script delegates to `npm run db:status` (`prisma migrate status`) and
returns its exit code. It does not apply or modify migrations.

The forward-only migrations add the persisted product models, including SM-2
flashcard review state and shared room-timer start timestamps, preserve task
category/tags/subtasks and the `IN_REVIEW` state, cascade task deletion with its
owner, and enforce single-use focus-session completions. `db:deploy` applies
these changes only to the `DATABASE_URL` supplied to that command; verify the
target database before applying migrations.

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

## Isolated PostgreSQL integration tests

The integration-test service is a separate Compose project and volume. It uses
PostgreSQL 16, publishes a dynamically selected free port only on `127.0.0.1`,
and creates the `taskora_test_core` database. Tests connect as
`taskora_test_user`, a database-owning role that is not a superuser and cannot
create roles or databases. A separate generated bootstrap credential is used
only by the container initialization process; it is not used by Prisma or the
tests.

Prerequisites: Docker Desktop (or Docker Engine) with the Compose plugin, and
the backend dependencies installed. From the repository root:

```bash
npm --prefix backend run db:test:up
npm --prefix backend run db:test:verify
npm --prefix backend run db:test:validate
npm --prefix backend run db:test:generate
npm --prefix backend run db:test:migrate
npm --prefix backend run db:test:status
npm --prefix backend run db:test:diff
npm --prefix backend run test:integration
npm --prefix backend run test:all
npm --prefix backend run db:test:down
```

The same scripts can be run from `backend/` without the `--prefix backend`
argument. The setup script generates random, test-only credentials in
`~/.taskora-test/postgres-compose.env` (on Windows, under the current user's
home directory). That file is outside the repository and is not printed.
`TASKORA_TEST_DATABASE_URL` is set only in the verification, migration, and
test child processes. Prisma's `DATABASE_URL` is overridden there to the same
verified loopback test database; no existing `.env` file is loaded by these
commands.

`db:test:migrate` applies the checked-in migrations with `prisma migrate
deploy`; it never resets or pushes a schema. `db:test:status` confirms migration
history, and `db:test:diff` uses Prisma's read-only schema diff to check that
the migrated database matches `schema.prisma`. `test:integration` runs the two
PostgreSQL tests serially. `test:all` runs the complete backend suite,
including those integration tests. The regular `npm test` command deliberately
clears database URL variables, runs tests serially, and cannot use a
development/production `DATABASE_URL`; database-dependent tests are reported
as skipped in that unit/API-only mode.

Both integration tests create uniquely identified records and delete their
test users in teardown, which cascades their related rows. They do not truncate
tables or reset the database, and can be rerun against the same dedicated test
database. `db:test:down` stops/removes only the test Compose container and
network; it preserves the isolated test volume so a later run can reuse the
migrations.

**Never point integration tests, migration commands, cleanup scripts, or
Prisma test configuration at a development or production database.** The
provided commands verify the exact test database name, host, port, role, role
permissions, and PostgreSQL major version before migration or test activity.
Do not manually override `TASKORA_TEST_DATABASE_URL` when using these scripts.

`postgresPersistence.test.js` covers persistence and ownership for users,
tasks, study plans, schedules, completions, and notifications.
`task3Task4Persistence.test.js` covers AI conversation/proposal and Brain Dump
persistence, task category/tags/subtasks and account-deletion behavior,
migration structure, and transactional rollback cases.

Troubleshooting:

- If Docker is unavailable, start Docker Desktop and retry `db:test:up`.
- If no port is available in the configured loopback range, stop the unrelated
  local service occupying that range; the script will not take its port.
- If PostgreSQL fails its readiness check, inspect only the dedicated test
  service with `docker compose --project-name taskora-postgres-test --file
  backend/docker-compose.test.yml logs postgres-test`. Do not inspect or alter
  the development database to resolve a test-service failure.

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

Profile photos are stored under `backend/uploads/profile-photos` for a native
backend. Docker Compose stores them in the separate `backend_profile_photos`
named volume mounted at `/app/uploads/profile-photos`, so rebuilding or
restarting the backend does not remove uploaded images. This photo volume is
independent of the PostgreSQL data volume.

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

Owner-scoped product APIs are also mounted under `/api`:

- Habits: `GET/POST /api/habits`, `PUT /api/habits/:id/check-ins`, `DELETE /api/habits/:id`
- Notes: `GET/POST /api/notes`, `PUT/DELETE /api/notes/:id`, public shared-note retrieval at `GET /api/notes/shared/:shareCode`
- Focus: `GET /api/focus/sessions`, `POST /api/focus/sessions/start`, and `POST /api/focus/sessions` to complete a server-timed session. The compatible `POST /api/focus-sessions` route is also available, along with `GET /api/focus-sessions/today`. Completion replays return the original session without awarding XP again.
- Study rooms: `GET/POST /api/study-rooms`, `POST /api/study-rooms/:id/join`, `POST /api/study-rooms/:id/messages`
- Gamification: `GET /api/gamification`; XP transactions are created by trusted server workflows, not a client-write endpoint.
- Analytics: `GET /api/analytics`
- Search: `GET /api/search?q=...`
- Account: `PATCH /api/auth/profile`, `PATCH /api/auth/password`, `DELETE /api/auth/account`
- Admin: `GET /api/admin/stats` (requires `UserRole.ADMIN`)

Password recovery:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Reset tokens are random, hashed before persistence, expire after 30 minutes,
and are invalidated after use. Known and unknown accounts receive the same
generic response. Local development defaults to a non-sending mock provider.
Configure Resend or the backward-compatible webhook to deliver real reset
instructions; production requires an explicit provider and HTTPS endpoints.
Provider errors are logged using diagnostic codes only, and the generic API
response does not reveal account existence or delivery details.

Study room synchronization:

- `GET /api/study-rooms/:id/events`

The endpoint uses Server-Sent Events and is authorized against room
membership. Events are in-process only; a Redis/pub-sub adapter is required
for cross-replicas synchronization.

### Request validation and protection

JSON request bodies are limited to 1 MiB. Malformed JSON returns `400`,
oversized bodies return `413`. A write request carrying an Authorization
header and a body must use `application/json`; missing or unsupported content
types return `415`. API errors use a generic JSON error object and do not
include stack traces or database/provider details. Responses include
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, and
`Cross-Origin-Resource-Policy: same-origin`; Express's `X-Powered-By` header
is disabled.

Task titles are limited to 120 characters and non-null descriptions to 1,000
characters; supplied text cannot be blank. Study-plan titles and subject names
are limited to 120 characters, supplied subject codes to 32 non-empty
characters, and each plan to 12 subjects. Detailed rules are in the API
contracts.

Notification history accepts pages 1–1,000 and limits 1–100 (default 20),
which bounds the maximum database offset to 99,900. Study-session completion
history accepts date ranges up to 365 days (`from` inclusive, `to` exclusive)
and returns at most 100 records per page by default. Its page is limited to
1–1,300 and its page size to 1–100.

Rate limits are per IP for registration/login (10 requests per 15 minutes),
and per authenticated user for AI Assistant/conversation messages (10 per
15 minutes), Brain Dump processing/creation (5 per 15 minutes), and conversation
creation/proposal decisions (30 combined per 15 minutes). These use the
express-rate-limit in-memory store: counts are per backend process and reset
when it restarts; replicas do not share counters. Express does not trust
forwarded IP headers by default, so place a correctly configured trusted proxy
in front of the API if client-IP rate limiting is needed behind a proxy. Rate
limiting is not a substitute for authentication or authorization.

Notifications that reference a task, study plan, or schedule item are checked
against the notification owner's records inside the same transaction used to
write the notification. `SYSTEM` notifications without related records remain
supported for trusted internal callers.

Deleting an owned `DRAFT` or `ARCHIVED` study plan is allowed only when it has
no completed sessions. If completion history exists, deletion returns `409`
and leaves the plan and its history intact. Activation/deactivation retains
the plan, schedule, and completion records.

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
- **Password reset email not delivered:** The default mock provider never sends
  mail. Configure `EMAIL_PROVIDER=resend` with a valid `EMAIL_API_KEY`, a
  provider-verified `EMAIL_FROM`, and the correct `PASSWORD_RESET_URL`, or
  configure the custom webhook. Production requires HTTPS and valid provider
  configuration at startup. A `2xx` response confirms provider acceptance,
  not inbox delivery.
- **Schema or migration issue:** `npm run db:validate` validates the Prisma
  schema; `npm run db:deploy` applies pending migrations. Do not use reset or
  schema-push commands against production. Check migration history and backups
  before a production rollout.
- **Dependency audit:** Run `npm audit` and `npm audit --omit=dev` from
  `backend/` before releases. Audit results apply to the checked-in dependency
  lockfile and should be refreshed when dependencies change.

Production deployment has not been tested against a production server or
database.
