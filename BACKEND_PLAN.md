# Taskora Backend Development Plan

This roadmap organizes the backend work into small milestones, from the current Express starter to a tested application integrated with the React frontend.

## Current starting point

- `backend/src/server.js` starts Express, enables JSON parsing and CORS, and serves a single `GET /` response.
- `backend/package.json` has Express, CORS, dotenv, and nodemon. Prisma, PostgreSQL access, JWT authentication, and AI provider integration are not configured.
- The frontend API in `src/lib/api/client.ts` uses mock data and browser `localStorage`; it does not call the Express server.
- A local `backend/.env` exists, but do not inspect, share, or commit its values. Use environment-variable names and placeholders in documentation.

## Principles for the work

1. Implement in the order below and keep each milestone small enough to test.
2. Keep the existing frontend mock behavior working until each corresponding backend feature is ready to integrate.
3. Keep secrets server-side. Never expose database credentials, JWT signing secrets, or AI provider keys through Vite variables or browser code.
4. Validate and authorize every request that reads or changes user-owned data.
5. Test each feature as it is built; the testing milestone later consolidates coverage and hardens error handling.
6. Treat suggested filenames as a practical starting structure, not as files that already exist.

## Suggested backend structure

Create folders as they become useful; avoid adding empty layers before a feature needs them.

```text
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── validators/
│   └── lib/
├── tests/
├── .env.example
└── package.json
```

For a beginner-friendly flow, routes define URL/method mappings, controllers handle HTTP input/output, services contain application rules, and Prisma handles database queries. Keep this separation lightweight and consistent.

---

## Milestone 1 — Plan and establish the backend foundation

### Phase 1. Backend project structure and API planning

**Tasks**

- Confirm backend entry points, scripts, port, and local development workflow.
- Agree on the initial API contract: resource names, HTTP methods, request/response shapes, status codes, and error format.
- Map frontend TypeScript types to server resources; identify which existing behaviors are only mock UI.
- Define ownership rules: authenticated users may access only their own data unless an explicit admin policy says otherwise.
- Add a health endpoint convention and document the local frontend/backend origins.

**Important files to create or update**

- `backend/src/server.js` — keep as the process entry point.
- `backend/src/app.js` — create the Express app and middleware so it can be tested independently.
- `backend/src/routes/index.js` — central route registration as routes are introduced.
- `backend/docs/api.md` or the root `README.md` — record implemented API contracts and mark future endpoints as planned.
- `backend/package.json` — keep scripts accurate as the app structure evolves.

**Expected outcome**

A clear, minimal backend layout and API plan that fits the existing frontend without implying that mock features already have server APIs.

**Testing requirements**

- Start the server with the development script and verify its health response.
- Import the app without starting a listening port in an app-level test.
- Check that unknown routes return the agreed error shape.

**Completion checklist**

- [ ] Entry point and app setup have distinct, documented responsibilities.
- [ ] Initial API resources and response conventions are written down.
- [ ] Local ports and origins are documented.
- [ ] Health and unknown-route behavior are testable.

### Phase 2. PostgreSQL and Prisma setup

**Tasks**

- Install Prisma packages only when implementation begins and update the backend lockfile.
- Create a local PostgreSQL database and keep its connection URL in `backend/.env`.
- Add a committed `backend/.env.example` containing variable names and safe placeholders only.
- Configure Prisma for PostgreSQL and generate the Prisma client.
- Add database connect/disconnect lifecycle handling and a database readiness check.

**Important files to create or update**

- `backend/package.json` and `backend/package-lock.json` — Prisma dependencies and scripts.
- `backend/.env.example` — names such as `DATABASE_URL`; never a real credential.
- `backend/prisma/schema.prisma` — datasource and generator configuration.
- `backend/src/lib/prisma.js` — shared Prisma client.
- `backend/src/server.js` — start after required configuration is validated; close cleanly on shutdown.

**Expected outcome**

The backend can connect to a local PostgreSQL database through Prisma without placing connection details in source code.

**Testing requirements**

- Validate Prisma configuration and generate the client.
- Connect to the local database with a small smoke check.
- Verify startup reports a clear configuration/connection error rather than silently pretending the database is ready.
- Do not use a production database for setup tests.

**Completion checklist**

- [ ] PostgreSQL is reachable using local environment configuration.
- [ ] Prisma schema parses and client generation succeeds.
- [ ] Secrets are absent from committed files and logs.
- [ ] Connection failure is visible and actionable.

---

## Milestone 2 — Data and core user workflows

### Phase 3. Database schema design and migrations

**Tasks**

- Design a normalized initial schema based on real product requirements, not only UI mock shapes.
- Start with `User` and `Task`; add Brain Dump, Study Plan, and Notification models when those phases need them.
- Define IDs, timestamps, unique constraints, indexes, enums, deletion behavior, and user relationships.
- Create and review the first migration; use seed data only for local development and tests.
- Agree how application types map to Prisma records and API DTOs.

**Important files to create or update**

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/prisma/seed.js` (only if useful)
- `backend/package.json` — schema, migration, and seed scripts as needed.
- `backend/docs/data-model.md` (optional, if schema decisions need explanation).

**Expected outcome**

A versioned database schema that can be recreated on a clean development database and safely evolved through migrations.

**Testing requirements**

- Apply migrations to a fresh local/test database.
- Verify key unique constraints and relationships.
- Confirm seed behavior is repeatable and is never required in production.
- Test migration status and document how to recover from a failed local migration.

**Completion checklist**

- [ ] Models and relations have been reviewed against product requirements.
- [ ] Fresh database migration succeeds.
- [ ] Constraints and indexes reflect actual query/use cases.
- [ ] Migration files are committed; generated local database files are not.

### Phase 4. User registration and login with password hashing and JWT

**Tasks**

- Define registration and login request/response contracts and duplicate-account behavior.
- Validate and normalize email and enforce a reasonable password policy.
- Hash passwords with a maintained password-hashing library; never store or log plaintext passwords.
- Sign and verify short-lived JWT access tokens using a server-only secret and explicit expiry.
- Add authentication middleware and return the authenticated user identity to protected handlers.
- Decide and document token renewal/logout behavior before choosing a storage strategy.

**Important files to create or update**

- `backend/src/routes/auth.routes.js`
- `backend/src/controllers/auth.controller.js`
- `backend/src/services/auth.service.js`
- `backend/src/middleware/auth.middleware.js`
- `backend/src/validators/auth.validators.js`
- `backend/prisma/schema.prisma` — user fields and unique email.
- `backend/.env.example` — JWT configuration names and safe placeholders.
- `backend/package.json` and lockfile — selected hashing/JWT/validation dependencies.

**Expected outcome**

Users can register and log in through server endpoints, and protected routes can identify the user from a verified token.

**Testing requirements**

- Test valid registration/login, duplicate email, invalid input, and incorrect password.
- Confirm stored credentials are hashes and never appear in responses.
- Test missing, malformed, expired, and invalid-signature tokens.
- Ensure user A cannot access user B's protected resources.

**Completion checklist**

- [ ] Passwords are hashed before persistence and compared securely.
- [ ] JWT secret is loaded only on the server and is not committed.
- [ ] Token expiry and client storage behavior are documented.
- [ ] Protected routes reject unauthenticated requests.

### Phase 5. Task Management APIs (CRUD)

**Tasks**

- Implement create, list, read, update, and delete task endpoints.
- Associate every task with its owner; enforce ownership in every query.
- Validate fields, allowed statuses/priorities, dates, and pagination/filter parameters.
- Return stable response shapes and appropriate status codes.
- Add filtering/sorting only where the frontend requires it; avoid unbounded list responses.

**Important files to create or update**

- `backend/src/routes/task.routes.js`
- `backend/src/controllers/task.controller.js`
- `backend/src/services/task.service.js`
- `backend/src/validators/task.validators.js`
- `backend/prisma/schema.prisma` — `Task` model and `User` relation.
- `backend/docs/api.md` — task endpoint contract and examples using fake data.

**Expected outcome**

An authenticated user can manage their own tasks through a documented, validated API.

**Testing requirements**

- Test successful CRUD operations and not-found behavior.
- Test invalid fields and invalid query parameters.
- Test that a user cannot read, update, or delete another user's task.
- Test pagination/filters if implemented and ensure list output is bounded.

**Completion checklist**

- [ ] All CRUD routes require authentication.
- [ ] Ownership checks apply to every operation.
- [ ] Inputs are validated and responses are documented.
- [ ] Automated tests cover normal and unauthorized cases.

---

## Milestone 3 — Study and AI workflows

### Phase 6. Brain Dump and AI Assistant

**Tasks**

- Implement Brain Dump create/list/update/delete behavior and ownership rules.
- Define the AI request/response contract and permitted proposal types.
- Call the AI provider from a backend service only; keep API keys out of the browser.
- Validate provider output against a strict schema before returning it.
- Preserve the review-before-save flow: an AI proposal must not modify tasks or plans until the user explicitly approves it.
- Add sensible timeouts, size limits, and rate limits for expensive provider requests.

**Important files to create or update**

- `backend/src/routes/brain-dump.routes.js`
- `backend/src/controllers/brain-dump.controller.js`
- `backend/src/services/brain-dump.service.js`
- `backend/src/routes/ai.routes.js`
- `backend/src/services/ai.service.js`
- `backend/src/validators/ai.validators.js`
- `backend/prisma/schema.prisma` — Brain Dump records and any approved proposal records needed.
- `backend/.env.example` — AI provider configuration names only.

**Expected outcome**

Brain Dump entries persist per user, and AI suggestions are produced server-side as validated proposals that require explicit approval before persistence.

**Testing requirements**

- Test Brain Dump CRUD and cross-user access denial.
- Mock the AI provider for tests; do not make real provider calls in routine test runs.
- Test malformed provider output, timeouts, provider errors, and oversized input.
- Verify an unapproved proposal causes no database changes.

**Completion checklist**

- [ ] Provider credentials are server-only.
- [ ] Provider output is validated before reaching the frontend.
- [ ] Proposal approval is explicit and tested.
- [ ] Provider failures are reported without exposing secrets or internal details.

### Phase 7. Smart Study Planner

**Tasks**

- Define study-plan and schedule-item data, including time zone and recurrence expectations.
- Implement authenticated plan creation, retrieval, update, and deletion.
- Validate dates, durations, workload limits, and overlapping schedule items.
- Keep schedule generation rules deterministic and testable; if AI is used, treat it as a suggestion and validate its output.
- Decide how plan changes interact with task deadlines and notifications.

**Important files to create or update**

- `backend/src/routes/study-plan.routes.js`
- `backend/src/controllers/study-plan.controller.js`
- `backend/src/services/study-plan.service.js`
- `backend/src/validators/study-plan.validators.js`
- `backend/prisma/schema.prisma` — plan and schedule-item models.
- `backend/docs/api.md` — schedule request/response formats.

**Expected outcome**

Users can persist and retrieve validated study plans, with schedule conflicts handled consistently.

**Testing requirements**

- Test create/read/update/delete and ownership.
- Test invalid dates, time zones, durations, and overlapping intervals.
- Test deterministic schedule rules with fixed inputs.
- If an AI provider is involved, test invalid or conflicting generated schedules.

**Completion checklist**

- [ ] Time zone and recurrence behavior are documented.
- [ ] Conflicts and invalid schedule data are rejected or handled by an explicit rule.
- [ ] Plan routes enforce authentication and ownership.
- [ ] Unit and API tests cover schedule edge cases.

---

## Milestone 4 — Notifications and reliability

### Phase 8. Notifications

**Tasks**

- Define notification types, recipient, message, creation time, and read state.
- Implement authenticated list and mark-read operations.
- Generate notifications from agreed application events, such as task deadlines or study-plan events.
- Keep notification generation idempotent where repeated event processing could create duplicates.
- Begin with in-app notifications; treat email, push, or real-time delivery as separate future scope.

**Important files to create or update**

- `backend/src/routes/notification.routes.js`
- `backend/src/controllers/notification.controller.js`
- `backend/src/services/notification.service.js`
- `backend/src/validators/notification.validators.js`
- `backend/prisma/schema.prisma` — notification model and indexes.
- Related task/planner services — notification creation hooks.

**Expected outcome**

Users can retrieve and mark their own in-app notifications as read, and selected application events can create them reliably.

**Testing requirements**

- Test list, unread/read state, and mark-read behavior.
- Test that users cannot access another user's notifications.
- Test duplicate event handling if notifications are generated asynchronously or retried.

**Completion checklist**

- [ ] Notification types and creation rules are documented.
- [ ] Ownership is enforced.
- [ ] Read-state behavior is covered by tests.
- [ ] External delivery channels are not implied unless implemented.

### Phase 9. Backend validation, error handling, and testing

**Tasks**

- Use consistent request validation for route parameters, query strings, and request bodies.
- Add centralized not-found and error middleware with stable public error responses.
- Avoid returning stack traces, SQL details, secrets, or provider internals to clients.
- Add unit tests for business rules and integration tests for routes/database behavior.
- Set up isolated test configuration and deterministic fixtures; reset test data safely.
- Add health/readiness checks and document commands contributors can run.
- Review logging for useful request/error context without passwords, tokens, or sensitive payloads.

**Important files to create or update**

- `backend/src/middleware/error-handler.js`
- `backend/src/middleware/not-found.js`
- `backend/src/validators/`
- `backend/tests/` — unit and API integration tests.
- `backend/package.json` — test and any test database scripts.
- `backend/src/app.js` — middleware order and testable app export.
- `backend/docs/api.md` — error response format.

**Expected outcome**

The backend fails predictably, reports actionable errors, and has repeatable automated tests for core routes and business rules.

**Testing requirements**

- Run unit and integration suites against a dedicated test database.
- Test validation failures, missing resources, authorization errors, and unexpected errors.
- Confirm production responses do not leak implementation details.
- Verify the documented test command works from a clean checkout after dependencies are installed.

**Completion checklist**

- [ ] Request validation is applied consistently.
- [ ] Error responses use a documented format and appropriate status codes.
- [ ] Core business rules and routes have automated tests.
- [ ] Logs and responses do not expose credentials or personal data unnecessarily.
- [ ] Test instructions are documented and reproducible.

---

## Milestone 5 — Frontend integration and release

### Phase 10. Frontend API integration

**Tasks**

- Confirm API contracts with backend tests/docs before switching each frontend feature.
- Add or update a typed HTTP client using the configured API base URL.
- Replace mock API calls incrementally, starting with authentication and tasks.
- Add loading, empty, validation-error, network-error, and expired-session states.
- Keep mock mode available during migration if it helps preserve the working UI.
- Do not move secrets into Vite variables or browser storage.

**Important files to create or update**

- `src/lib/api/client.ts` or a new `src/lib/api/httpClient.ts` — typed HTTP transport.
- `src/lib/api/` — feature adapters with the existing UI-facing types.
- `src/context/AuthContext.tsx` — integrate actual server authentication when ready.
- Root `.env.example` — document only public frontend settings such as the API base URL.
- `backend/docs/api.md` and `README.md` — keep contracts and setup aligned.

**Expected outcome**

The frontend can use real backend endpoints feature by feature without breaking unrelated prototype screens.

**Testing requirements**

- Keep frontend type checks and production build passing.
- Test API success, validation errors, unavailable server, and expired authentication.
- Run end-to-end checks for each switched feature against a local backend.
- Verify no provider, database, or JWT secret appears in frontend bundles or network requests.

**Completion checklist**

- [ ] API types and server contracts agree.
- [ ] Each migrated feature has loading and error handling.
- [ ] Mock behavior remains available until its replacement is verified.
- [ ] End-to-end checks pass for each integrated feature.

### Phase 11. Security improvements and deployment

**Tasks**

- Restrict CORS to known frontend origins and configure production environment settings.
- Add appropriate security headers, request-size limits, rate limits, and authentication protections.
- Review JWT lifetime, refresh/revocation strategy, password policy, and sensitive response fields.
- Use TLS in deployment, managed secret storage, least-privilege database credentials, and database backups.
- Define production migration and rollback procedures; do not run development seed data in production.
- Add structured operational logs, health checks, and basic monitoring.
- Deploy frontend, API, and PostgreSQL using separate, documented environment configurations.

**Important files to create or update**

- `backend/src/app.js` and `backend/src/config/` — production CORS/security configuration.
- `backend/.env.example` — names and placeholders only.
- `backend/prisma/` — reviewed migrations and production migration procedure.
- `README.md` — deployment prerequisites and safe operational instructions.
- Hosting/platform configuration files, if selected by the team.

**Expected outcome**

A production deployment can be configured without committing secrets, with controlled origins, safe database migrations, and basic operational visibility.

**Testing requirements**

- Run security checks and dependency audits supported by the project tooling.
- Test allowed and rejected origins, rate limits, and production error responses.
- Apply migrations to a staging database before production.
- Verify backups and restoration procedure in a non-production environment.
- Smoke-test authentication and core APIs after deployment.

**Completion checklist**

- [ ] Production secrets are stored outside the repository.
- [ ] CORS, TLS, headers, request limits, and rate limits are configured.
- [ ] Migrations and rollback/recovery procedures are documented.
- [ ] Staging smoke tests pass and backups are verified.
- [ ] Deployment and monitoring instructions are current.

---

## Suggested first implementation slice

After reviewing this roadmap, a practical first slice is to complete Phases 1–3, then implement registration/login and task CRUD (Phases 4–5). Keep the frontend on mock data until those APIs have tests and a clear contract. Do not start AI integration or deployment work before database ownership, authentication, and error handling are established.
