# Taskora

*Organize Your Life. Focus on Your Goals. Achieve More.*

Taskora is a productivity and study-management application for university students and knowledge workers. Its React frontend presents a dashboard and tools for tasks, study planning, focus sessions, habits, notes, and AI-assisted organization.

> **Project status:** The frontend is an interactive prototype whose typed API layer still uses browser `localStorage` and mock data. The backend now provides authenticated PostgreSQL/Prisma APIs for authentication, tasks, AI Assistant, Brain Dump, Study Planner, and notifications. The frontend is not yet integrated with those endpoints, and several prototype features remain frontend-only. See the [backend deployment guide](./backend/README.md), [backend API contract](./docs/backend-api-contract.md), and [Phase 06 contract](./docs/phase06-api-contract.md).

## Current features and prototype scope

The existing frontend describes these screens and interactions:

| Requirement | Route | Frontend scope |
|---|---|---|
| **FR-01 Authentication** | `/login`, `/register`, `/forgot-password` | Form validation, password-strength display, and demo Student/Admin switcher. This is not server authentication. |
| **FR-02 Dashboard** | `/dashboard` | Four pastel stat cards, productivity chart, quick-add to-do list, mini calendar, recent activity, and bunny motivation card. |
| **FR-03 AI Assistant** | `/ai-assistant` | Conversation UI and structured proposals with approve/edit/reject review actions. A backend text-response endpoint exists, but proposal generation/approval is not integrated. |
| **FR-04 Task Management** | `/tasks` | List and Kanban views, priority badges, category filters, subtasks, and bulk operations. |
| **FR-05 Smart Study Planner** | `/study-planner` | Subject workload and weekly timetable UI. Backend plan CRUD and deterministic schedule preview/persistence endpoints exist, but the UI is not integrated. |
| **FR-06 Focus Mode** | `/focus` | Circular 25/5 Pomodoro timer, subject label, ambient sound simulation, and Zen mode. |
| **FR-07 Habit Tracker** | `/habits` | Single-click check-ins, streak display, and 28-day activity history. |
| **FR-08 Analytics** | `/analytics` | 7D/30D/semester selectors, focus trends, and course distribution charts. |
| **FR-09 Gamification** | `/achievements` | Scholar levels, XP progress, badges, and transaction-style history UI. |
| **FR-10 Study Workspace** | `/workspace` | Subject-organized notes and editor UI with private-by-default and sharing controls. |
| **FR-11 Brain Dump** | `/brain-dump` | Quick thought capture and an AI organization proposal flow. The backend can process text into proposed tasks, but does not persist entries or tasks. |
| **FR-12 Virtual Study Rooms** | `/study-rooms` | Public/private room UI, passcode flow, synchronized timer, participants, and quiet chat. |
| **FR-13 Notifications** | `/notifications` | Notification center UI for deadline, habit, room, and achievement alerts. |
| **FR-14 Search and Filter** | `/search` | Search UI for tasks, notes, and habits with filter tabs. |
| **FR-15 Profile and Settings** | `/settings` | Profile/degree details, privacy controls, password-management UI, and JSON export option. |
| **FR-16 Administration** | `/admin` | Admin-style overview, student directory, moderation queue, and audit-log UI; this is not server-side authorization. |
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
| Frontend data layer | Typed mock API and browser `localStorage` | Present; not connected to Express |
| Backend | Node.js, Express, CORS, dotenv | Authenticated API routes present |
| Database | PostgreSQL | Prisma-backed schema and migrations present |
| ORM | Prisma | Configured in `backend/` |
| Authentication | bcrypt password hashing and JWT | Backend endpoints present; frontend sign-in remains a demo |
| AI integration | Google Gemini through the backend | Assistant and Brain Dump endpoints present; frontend proposal flow remains local |

## Architecture

### Current implementation

1. The browser runs the React application using Vite.
2. Pages call the typed API functions in `src/lib/api/client.ts`.
3. Those functions use mock data, simulated delays, and browser `localStorage`.
4. The Express server exposes health checks and authenticated APIs. The frontend does not currently call them.

### Planned architecture

The intended integrated data flow is:

`React UI → typed frontend API client → Express routes/controllers/services → Prisma → PostgreSQL`

The backend already handles authentication, authorization, input validation, and AI provider calls; connecting the frontend API client to those routes remains pending. The frontend should never contain database credentials, JWT signing secrets, or AI provider keys. See [BACKEND_PLAN.md](./BACKEND_PLAN.md) for milestones and checks.

## Project structure

```text
taskora/
├── backend/
│   ├── src/                      # Express API server
│   ├── prisma/                   # Schema and migrations
│   ├── Dockerfile
│   ├── docker-compose.yml        # Development stack
│   ├── package.json
│   └── README.md                 # Backend setup and deployment
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ai/                   # AI proposal UI
│   │   ├── common/               # Reusable UI components
│   │   ├── dashboard/            # Dashboard widgets
│   │   ├── layout/               # App shell, sidebar, top bar
│   │   └── theme/                # Theme preview and contrast UI
│   ├── context/                  # Authentication-demo and theme contexts
│   ├── lib/
│   │   ├── api/                  # Typed mock API and its acceptance test
│   │   └── mockData.ts
│   ├── pages/                    # App routes and page components
│   ├── styles/                   # Global CSS and design tokens
│   ├── types/                    # Shared TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── .env.example                  # Root reference placeholders; not backend config
├── package.json
├── package-lock.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── BACKEND_PLAN.md
```

`node_modules`, generated build output, and local secret files are omitted from this tree. Do not add local environment files or credentials to version control.

## Prerequisites

- Node.js 22 LTS and npm for local backend development.
- PostgreSQL for native backend development, or Docker Desktop with the Compose plugin for containerized backend development.
- The frontend mock prototype can run independently of PostgreSQL.

## Installation and setup

From the repository root:

```bash
npm install
```

For backend-specific installation, environment variable names, database setup,
Docker development, production migration order, and troubleshooting, see the
[backend deployment guide](./backend/README.md).

## Environment variables

The root [.env.example](./.env.example) is a reference file for frontend settings; it is not a backend configuration template. Do not copy real credentials into source control, and do not paste secret values into this README.

### Frontend

Create a root `.env` for local Vite settings as needed. The existing example names `VITE_HOST`, `VITE_PORT`, and `VITE_API_BASE_URL`. Variables prefixed with `VITE_` are intended for frontend use and may be included in browser code; **never put secrets in them**.

The frontend currently continues to use its mock API and local storage. Setting an API URL alone does not connect it to the backend.

### Backend

The backend reads server-side configuration from its process environment.
Required and optional backend variable **names** and their purposes are listed
in the [backend deployment guide](./backend/README.md). Keep database, JWT, and
AI provider secrets out of frontend variables and source control.

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

This runs the backend development server with nodemon, normally at `http://localhost:5000`. To run without nodemon:

```bash
npm start
```

The backend exposes authenticated application APIs and health routes. See the API contract documents below for available endpoints.

## PostgreSQL and Prisma setup

The backend uses PostgreSQL through Prisma. Its schema and checked-in migrations are under `backend/prisma`; local database access requires the server-side `DATABASE_URL` described above. Keep development, test, and production databases separate. Do not use production credentials for local tests.

For local preparation:

1. Install and start PostgreSQL using the instructions for your operating system.
2. Create a development database using your local PostgreSQL tools.
3. Configure a local `DATABASE_URL` in `backend/.env`; never use production credentials for development.
4. From `backend/`, use the Prisma commands documented in `backend/package.json`. Review the migration workflow before applying migrations to any shared or production database.

Use a separate database for tests and production. Never put real database credentials in source files or commit them.

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

The backend API base URL is `http://localhost:5000`. The implemented endpoint
contracts, authentication requirements, DTOs, validation rules, and frontend
compatibility gaps are documented in the
[Taskora Backend API Contract](./docs/backend-api-contract.md). Study Planner
and notification details are in the [Phase 06 contract](./docs/phase06-api-contract.md).

## Testing and acceptance scenarios

The root package defines `npm run build`. The backend uses Node's built-in test runner; run its suite with `npm --prefix backend test`. The frontend acceptance test and the product scenarios below do not imply that every scenario has been run or that every feature is backed by a server.

The original README listed the following SRS acceptance scenarios. They are retained as product checks, **not as a claim that they have all been run or that every feature is supported by the backend**. Continue adding focused frontend, API, and database tests as the product is integrated.

- **TC01 Registration and login:** register with valid credentials, evaluate password strength, and persist the demo session.
- **TC02 Task CRUD:** create, complete, edit, filter, and delete tasks; completion may trigger confetti.
- **TC03 AI task request:** turn a natural-language request into a structured proposal.
- **TC04 Approve AI proposal:** only save a proposed action after explicit approval.
- **TC05 Focus mode:** run a configurable timer, record a session, and award XP.
- **TC06 Habit check-in:** update a daily streak while retaining historical check-ins.
- **TC07 Study plan:** distribute weekly study hours across subjects.
- **TC08 Brain Dump:** capture unstructured text and propose an organized result.
- **TC09 Gamification:** attribute XP to its source and avoid duplicate awards.
- **TC10 Study rooms:** validate a private-room passcode before joining.
- **TC11 Analytics:** calculate focus-time and completion metrics for charts.
- **TC12 Authorization:** protect admin operations by role on the server (planned).
- **TC13 Theme preferences:** persist custom colors, card borders, and dark mode.
- **TC14 Dashboard customization:** persist widget visibility and ordering.

## Next steps

The backend API is implemented, but the frontend still uses mock data. The
current integration and deployment work is to connect the frontend client to
the documented contracts and validate deployment in the target production
environment. See the [backend deployment guide](./backend/README.md), the
[API contract](./docs/backend-api-contract.md), and the original
[backend plan](./BACKEND_PLAN.md) for additional project context.

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
