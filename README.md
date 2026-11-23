# Taskora

*Organize Your Life. Focus on Your Goals. Achieve More.*

Taskora is a productivity and study-management application for university students and knowledge workers. Its React frontend presents a dashboard and tools for tasks, study planning, focus sessions, habits, notes, and AI-assisted organization.

> **Project status:** Authentication, tasks, notifications, AI, Study Planner, flashcards, habits, notes, focus sessions, study rooms, gamification summaries, analytics and search have owner-scoped API adapters. Password recovery uses persisted, expiring, single-use tokens; real email delivery requires Resend credentials or a configured delivery webhook. Study rooms use persisted shared timers with same-process SSE events and client polling fallback. Cross-replica real-time delivery requires pub/sub configuration.

## Current features and prototype scope

The existing frontend describes these screens and interactions:

| Requirement | Route | Frontend scope |
|---|---|---|
| **FR-01 Authentication** | `/login`, `/register`, `/forgot-password` | Registration/login use JWT. Password recovery uses persisted, expiring, single-use reset tokens and a configurable email provider or webhook. |
| **FR-02 Dashboard** | `/dashboard` | Four pastel stat cards, productivity chart, quick-add to-do list, mini calendar, recent activity, and bunny motivation card. |
| **FR-03 AI Assistant** | `/ai-assistant` | Persistent conversations and structured task proposals; proposals require explicit approval or rejection. |
| **FR-04 Task Management** | `/tasks` | Backend-backed list, create, edit, completion and delete operations. |
| **FR-05 Smart Study Planner** | `/study-planner`, `/calendar` | Backend-backed plan CRUD, calendar data, schedule previews, completion history and activation/deactivation operations. |
| **FR-06 Focus Mode** | `/focus` | Configurable Pomodoro timer shared with the dashboard and restored from per-user session storage; completion is recorded once by the server before XP is awarded. |
| **FR-07 Habit Tracker** | `/habits` | Persisted habits and date check-ins through owner-scoped APIs. |
| **FR-08 Analytics** | `/analytics` | 7D/30D/semester selectors, focus trends, and course distribution charts. |
| **FR-09 Gamification** | `/achievements` | Scholar levels, XP progress, badges, and transaction-style history UI. |
| **FR-10 Study Workspace** | `/workspace` | Persisted private-by-default notes through owner-scoped APIs. |
| **FR-12 Virtual Study Rooms** | `/study-rooms` | Persisted room creation, passcode-protected join, owner-only edit/delete/timer controls, leave actions, and SSE with polling fallback. Cross-replicas delivery requires pub/sub. |
| **Flashcards** | `/flashcards` | Owner-scoped deck/card management with persisted SM-2 review scheduling. |
| **FR-13 Notifications** | `/notifications` | Backend-backed notification center with read/read-all, deletion actions, synchronized unread count, and visible request errors. |
| **FR-14 Search and Filter** | `/search` | Search UI for tasks, notes, and habits with filter tabs. |
| **FR-15 Profile and Settings** | `/settings` | Profile/degree details, privacy controls, password-management UI, and JSON export option. |
| **FR-16 Administration** | `/admin` | Admin metrics, moderation queue, and audit-log UI. Backend admin endpoints enforce the `ADMIN` role; user-directory and role-management APIs are not implemented. |
| **FR-17 Theme Management** | `/theme-studio` | Lavender, Mint, Peach, Midnight, and Bubblegum palettes; custom colors, contrast warnings, and live preview. |
| **FR-18 Dashboard Personalization** | `/dashboard` | Widget visibility and ordering controls with browser persistence. |
| **FR-19 Decorative Personalization** | `/theme-studio` | Mascot options (Bunny, Kitten, Bear, None) and decoration toggle. |
| **FR-20 Preference Synchronization** | Across the app | LocalStorage persistence and reset-to-defaults UI; cross-device synchronization is not implemented. |

## Visual identity: Lavender Dream

The frontend uses a soft pastel visual system with rounded cards, generous spacing, and accessible contrast as a design goal:

- Primary lavender: `#9885E8`; soft lilac: `#C7B9F5`
- Background: `#F5F1FF`; white surface: `#FFFFFF`
- Deep purple text: `#55458A`; muted purple: `#A99CCB`
- Pink: `#F7DDED`; mint: `#DDF3E9`; peach/amber: `#FEF3D6`; blue: `#E8F1FF`
- Dark-mode surface: `#1E163B`
- Mascot: Bramble the Bunny

## Technology stack

| Area | Technology | Status |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, React Router | Present |
| Styling and UI | Tailwind CSS, CSS design tokens, Lucide | Present |
| Charts and animation | Recharts, Framer Motion, Canvas Confetti, Web Audio API | Present in frontend |
| Frontend data layer | Typed API client plus browser `localStorage` preferences | Authentication, tasks, Study Planner, AI, notifications and product data use Express; theme/dashboard preferences remain browser-local |
| Backend | Node.js, Express, CORS, dotenv | Authenticated API routes present |
| Database | PostgreSQL | Prisma-backed schema and migrations present |
| ORM | Prisma | Configured in `backend/` |
| Authentication | bcrypt password hashing and JWT | Backend-backed registration and login |
| AI integration | Google Gemini through the backend | Assistant conversations and proposals use authenticated backend APIs; the active conversation identifier is stored in session storage. Gemini endpoints require server-side provider configuration. |

## Architecture

### Current implementation

1. The browser runs the React application using Vite.
2. Authentication, tasks, Study Planner, calendar, AI, notifications, and persisted product modules call the typed API client in `src/lib/api/client.ts`, which sends the JWT to the Express API.
3. Product data is owner-scoped through the Express API where implemented. Theme and dashboard preferences remain browser-local.
4. The Express server exposes authentication and persisted feature routes backed by Prisma and PostgreSQL.

### Remaining architecture work

Some visual personalization and cross-device preference synchronization remain local-only:

`React UI → typed frontend API client → Express routes/controllers/services → Prisma → PostgreSQL`

Authentication, authorization, input validation, and AI provider calls are handled server-side. The frontend should never contain database credentials, JWT signing secrets, or AI provider keys. See [BACKEND_PLAN.md](./BACKEND_PLAN.md) for remaining milestones and checks.

## Project structure

```text
taskora/
├── backend/
│   ├── src/
│   │   └── server.js             # Express API server
│   ├── prisma/                   # Prisma schema and migrations
│   ├── Dockerfile
│   ├── docker-compose.yml        # Local API and PostgreSQL stack
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example              # Server-side environment template
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ai/                   # AI proposal UI
│   │   ├── common/               # Reusable UI components
│   │   ├── dashboard/            # Dashboard widgets
│   │   ├── layout/               # App shell, sidebar, top bar
│   │   └── theme/                # Theme preview and contrast UI
│   ├── context/                  # JWT authentication and theme contexts
│   ├── lib/
│   │   ├── api/                  # Typed backend client
│   │   └── defaults.ts           # Default theme and dashboard preferences
│   ├── pages/                    # App routes and page components
│   ├── styles/                   # Global CSS and design tokens
│   ├── types/                    # Shared TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── .env.example                  # Frontend API URL and local settings reference
├── package.json
├── package-lock.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── BACKEND_PLAN.md
```

`node_modules`, generated build output, and local secret files are omitted from this tree. Do not add local `.env` files or credentials to version control.

## Prerequisites

- Node.js 22 LTS and npm for backend development (the backend Docker image uses Node 22).
- npm
- Docker Desktop with the Compose plugin for the containerized backend and PostgreSQL, or a local PostgreSQL installation.
- The frontend shell can start independently, but authentication and persisted product features require the API and PostgreSQL database.

## Installation and setup

From the repository root:

```bash
npm install
```

For backend-specific installation, environment variable names, database setup,
Docker development, production migration order, and troubleshooting, see the
[backend deployment guide](./backend/README.md).

## Environment variables

The root [.env.example](./.env.example) contains frontend settings. Backend secrets and database settings belong in `backend/.env`, based on [backend/.env.example](./backend/.env.example). Do not commit `.env` files or paste secret values into this README.

### Frontend

Create a root `.env` for local Vite settings as needed. The existing example names `VITE_HOST`, `VITE_PORT`, and `VITE_API_BASE_URL`. Variables prefixed with `VITE_` are intended for frontend use and may be included in browser code; **never put secrets in them**.

Authentication, tasks, Study Planner, AI, notifications and product APIs use this API base URL. Theme and dashboard preferences remain browser-local.

### Backend

The server calls `dotenv.config()` and reads `.env` relative to the backend process's working directory. Create `backend/.env` from the backend example before starting the API. The Compose setup requires the PostgreSQL, `JWT_SECRET`, and `DATABASE_URL` values shown in that example. Gemini-powered features require both `GEMINI_API_KEY` and `GEMINI_MODEL`; neither is needed for server startup. Local password-reset delivery defaults to a non-sending mock; production requires a configured provider. These settings are server-only:

```dotenv
POSTGRES_DB=taskora_db
POSTGRES_USER=<local-user>
POSTGRES_PASSWORD=<unique-local-password>
DATABASE_URL=postgresql://<local-user>:<password>@postgres:5432/taskora_db?schema=public
JWT_SECRET=<random-secret-of-at-least-32-bytes>
GEMINI_API_KEY=<your-provider-key>
GEMINI_MODEL=<supported-model-name>
EMAIL_PROVIDER=mock
EMAIL_FROM=no-reply@example.invalid
EMAIL_FROM_NAME=Taskora
PASSWORD_RESET_URL=http://localhost:5173/forgot-password
```

For real password-reset delivery, select `EMAIL_PROVIDER=resend` and configure `EMAIL_API_KEY`, a provider-verified `EMAIL_FROM`, `EMAIL_FROM_NAME`, and the deployed HTTPS `PASSWORD_RESET_URL`; alternatively configure the existing webhook provider. The checked-in [`backend/.env.example`](./backend/.env.example) contains names and placeholders, not working credentials. Do not commit `.env` files. Keep database credentials, `JWT_SECRET`, email provider keys, and AI provider keys out of frontend variables and client-side code. See the [backend external-service setup](./backend/README.md#external-service-integrations) for details.

## Running the application

### Frontend

From the repository root:

```bash
npm run dev
```

Vite normally serves the app at `http://localhost:5173`. To create and locally preview a production build:

```bash
npm run build
npm run preview
```

The build output is written to `dist/`.

### Backend

In a separate terminal:

```bash
cd backend
npm run dev
```

This runs the API server with nodemon, normally at `http://localhost:5000`. The database must be available and migrations applied. For containerized development, use Docker Compose from `backend/`; PostgreSQL is exposed on host port `5433`. To run the API directly with `npm run dev`, configure `DATABASE_URL` for the database address reachable from the host (for the Compose database, use `localhost:5433`) and set `JWT_SECRET`. To run without nodemon:

```bash
npm start
```

The backend exposes a health response at `GET /` and authenticated application APIs described below.

## PostgreSQL and Prisma setup

PostgreSQL and Prisma are configured in the backend. The schema and migrations are under `backend/prisma`, and `backend/docker-compose.yml` defines the local PostgreSQL and API services.

For containerized local development:

1. Copy `backend/.env.example` to `backend/.env` and set unique local PostgreSQL and JWT values.
2. From `backend/`, start the services with `docker compose up --build`.
3. Apply the checked-in migrations from `backend/` with `docker compose exec backend npx prisma migrate deploy` before using database-backed APIs.

Use a separate database for tests and production. Never put real database credentials in source files or commit them.

The backend integration suite uses a dedicated PostgreSQL 16 Compose project,
database, restricted test role, and loopback-only port. Its setup, migration,
verification, test, and shutdown commands are documented in the
[isolated PostgreSQL test setup](./backend/README.md#isolated-postgresql-integration-tests).

### Production migration sequence

The backend exposes a one-shot production migration command:

```bash
npm --prefix backend run db:deploy
```

It runs `prisma migrate deploy` against `backend/prisma/schema.prisma` and its
adjacent `backend/prisma/migrations` directory. Run it from a single release or
migration job using the deployment's `DATABASE_URL`, wait for success, and only
then deploy or roll out application replicas. The app start command
(`npm start`, also the Docker production target's Node entry point) does not
apply migrations, so replicas will not race to migrate during startup. The
multi-stage Dockerfile has a separate `migration` target containing Prisma CLI:

```bash
docker build --target migration -t taskora-backend-migrate:release backend
docker run --rm -e DATABASE_URL taskora-backend-migrate:release
```

Run that one-shot job once and require a successful exit before deploying the
production image. Build the runtime image separately with
`docker build --target production -t taskora-backend:release backend`. The
checked-in `backend/docker-compose.yml` explicitly builds the `development`
target and remains a local development stack; it is not the production
migration runner.

## API documentation

### Currently implemented

The backend exposes these API areas:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Backend health response. |
| `POST` | `/api/auth/register` | Register an account. |
| `POST` | `/api/auth/login` | Sign in and receive a JWT. |
| `GET` | `/api/auth/me` | Resolve the authenticated user. |
| `*` | `/api/study-plans/*` | Study-plan CRUD, schedule preview, and completion operations; see [Phase 06 API contract](./docs/phase06-api-contract.md). |
| `*` | `/api/tasks/*`, `/api/ai/*`, `/api/notifications/*` | Task, AI, and notification APIs. |
| `*` | `/api/habits/*`, `/api/notes/*`, `/api/focus/*`, `/api/study-rooms/*` | Persisted habits, notes, timed focus sessions, and study rooms. |
| `*` | `/api/gamification`, `/api/analytics`, `/api/search`, `/api/admin/*`, `/api/reports` | XP summaries, analytics, unified search, moderation, and role-protected admin operations. |

Local base URL: `http://localhost:5000`. The frontend API base URL is configured with `VITE_API_BASE_URL`.

### Frontend integration gaps

Implemented frontend integrations use the documented backend contracts. Remaining browser-local preferences and any explicitly documented prototype limitations are not server-backed until an endpoint is implemented.

## Testing and acceptance scenarios

The root package defines `npm run build` and `npm run test:run`; the backend package defines `npm test`. These tests do not imply end-to-end coverage for every product scenario.

The original README listed the following SRS acceptance scenarios. They are retained as product checks, **not as a claim that they have all been run or that every feature is backed by the backend**. Add focused frontend, API, and database tests as integration work continues.

- **TC01 Registration and login:** register with valid credentials, evaluate password strength, and authenticate against the backend.
- **TC02 Task CRUD:** create, complete, edit, filter, and delete tasks; completion may trigger confetti.
- **TC03 AI task request:** turn a natural-language request into a structured proposal.
- **TC04 Approve AI proposal:** only save a proposed action after explicit approval.
- **TC05 Focus mode:** run a configurable timer, complete a server-timed session, and award XP once.
- **TC06 Habit check-in:** update a daily streak while retaining historical check-ins.
- **TC07 Study plan:** create a plan, generate a preview from explicit availability windows, and test saved-item completion endpoints.
- **TC09 Gamification:** attribute XP to its source and avoid duplicate awards.
- **TC10 Study rooms:** validate a private-room passcode before joining.
- **TC11 Analytics:** calculate focus-time and completion metrics for charts.
- **TC12 Authorization:** protect admin operations by role on the server.
- **TC13 Theme preferences:** persist custom colors, card borders, and dark mode.
- **TC14 Dashboard customization:** persist widget visibility and ordering.

## Next steps

The backend provides authentication, task, AI Assistant, Study Planner, notification, habits, notes, focus, rooms, gamification, analytics and search APIs. Password recovery requires a configured delivery webhook. Room SSE synchronization is single-process and needs pub/sub for multiple replicas. Validate database-backed integrations and deployment in the target environment. [BACKEND_PLAN.md](./BACKEND_PLAN.md) is the original implementation roadmap and may not reflect the current completion status of every milestone.

## Team contribution overview

Contributors can share or rotate these responsibilities; no individual assignments are assumed:

- **Frontend:** maintain React pages and types, integrate API calls, and cover loading/error/empty states.
- **Backend:** define Express routes and services, enforce authentication/authorization, validate inputs, and write API tests.
- **Database:** review Prisma models, migrations, constraints, and seed/test data.
- **AI integration:** keep provider calls server-side, validate structured results, and test approval flows.
- **Quality and documentation:** verify setup on a clean checkout, run relevant builds/tests, and keep API/roadmap documentation current.

Suggested workflow: create a focused branch, keep secrets out of commits, make small changes, run the checks relevant to the change, and request review before merging. Coordinate API contract changes with both frontend and backend contributors.

## Contributing and local changes

- Do not commit `.env` files, API keys, passwords, database dumps, or generated dependencies.
- Keep the mock API working until a backend feature is implemented and tested end-to-end.
- Update this README and the backend roadmap when project capabilities or setup steps change.
- Record whether a feature is a frontend prototype, locally integrated API, or production-ready feature; avoid claiming completion based only on a screen existing.
