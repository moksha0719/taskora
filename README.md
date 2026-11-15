# Taskora

*Organize Your Life. Focus on Your Goals. Achieve More.*

Taskora is a productivity and study-management application for university students and knowledge workers. Its React frontend presents a dashboard and tools for tasks, study planning, focus sessions, habits, notes, and AI-assisted organization.

> **Project status:** The frontend is an interactive prototype. Its typed API layer currently uses browser `localStorage` and mock data. The Express backend is an initial starter with a single `GET /` route. PostgreSQL, Prisma, JWT authentication, feature APIs, and server-side AI integration are planned, not implemented. The feature descriptions below preserve the existing product scope; they should not be read as proof that every scenario has been tested or that data is backed by a server.

## Current features and prototype scope

The existing frontend describes these screens and interactions:

| Requirement | Route | Frontend scope |
|---|---|---|
| **FR-01 Authentication** | `/login`, `/register`, `/forgot-password` | Form validation, password-strength display, and demo Student/Admin switcher. This is not server authentication. |
| **FR-02 Dashboard** | `/dashboard` | Four pastel stat cards, productivity chart, quick-add to-do list, mini calendar, recent activity, and bunny motivation card. |
| **FR-03 AI Assistant** | `/ai-assistant` | Conversation UI and structured proposals with approve/edit/reject review actions. Server-side AI and persistent approval are planned. |
| **FR-04 Task Management** | `/tasks` | List and Kanban views, priority badges, category filters, subtasks, and bulk operations. |
| **FR-05 Smart Study Planner** | `/study-planner` | Subject workload, weekly targets, and conflict-free AI timetable UI. A real schedule service is planned. |
| **FR-06 Focus Mode** | `/focus` | Circular 25/5 Pomodoro timer, subject label, ambient sound simulation, and Zen mode. |
| **FR-07 Habit Tracker** | `/habits` | Single-click check-ins, streak display, and 28-day activity history. |
| **FR-08 Analytics** | `/analytics` | 7D/30D/semester selectors, focus trends, and course distribution charts. |
| **FR-09 Gamification** | `/achievements` | Scholar levels, XP progress, badges, and transaction-style history UI. |
| **FR-10 Study Workspace** | `/workspace` | Subject-organized notes and editor UI with private-by-default and sharing controls. |
| **FR-11 Brain Dump** | `/brain-dump` | Quick thought capture and an AI organization proposal flow. |
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
| Backend | Node.js, Express, CORS, dotenv | Starter server present |
| Database | PostgreSQL | Planned; no schema or database connection yet |
| ORM | Prisma | Planned; not configured yet |
| Authentication | Password hashing and JWT | Planned; current sign-in is a frontend demo |
| AI integration | Provider API called from the backend | Planned; keep provider keys server-side |

## Architecture

### Current implementation

1. The browser runs the React application using Vite.
2. Pages call the typed API functions in `src/lib/api/client.ts`.
3. Those functions use mock data, simulated delays, and browser `localStorage`.
4. The Express server in `backend/src/server.js` has JSON parsing, permissive CORS, and a basic `GET /` response. The frontend does not currently call it.

### Planned architecture

The intended production data flow is:

`React UI → typed frontend API client → Express routes/controllers/services → Prisma → PostgreSQL`

Authentication, authorization, input validation, and AI provider calls will be handled server-side. The frontend should never contain database credentials, JWT signing secrets, or AI provider keys. See [BACKEND_PLAN.md](./BACKEND_PLAN.md) for milestones and checks.

## Project structure

```text
taskora/
├── backend/
│   ├── src/
│   │   └── server.js             # Express starter; currently only GET /
│   ├── package.json
│   ├── package-lock.json
│   └── .env                      # Local only; do not commit
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
├── .env.example                  # Root reference for frontend and planned settings
├── package.json
├── package-lock.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── BACKEND_PLAN.md
```

`node_modules`, generated build output, and local secret files are omitted from this tree. The backend `.env` shown above is machine-local and must not be added to version control.

## Prerequisites

- Node.js 18+ (or a compatible current LTS release)
- npm
- PostgreSQL is needed for the planned database work; the current frontend prototype and starter `GET /` route do not require a database.

## Installation and setup

From the repository root:

```bash
npm install
```

For the backend, open a second terminal:

```bash
cd backend
npm install
```

These install the dependencies declared by the respective package manifests. The root and backend are separate npm projects.

## Environment variables

The root [.env.example](./.env.example) is a reference file containing frontend settings and placeholders for planned backend settings. It is not a backend configuration template. Do not copy real credentials into source control, and do not paste secret values into this README.

### Frontend

Create a root `.env` for local Vite settings as needed. The existing example names `VITE_HOST`, `VITE_PORT`, and `VITE_API_BASE_URL`. Variables prefixed with `VITE_` are intended for frontend use and may be included in browser code; **never put secrets in them**.

The frontend currently continues to use its mock API and local storage. Setting an API URL alone does not connect it to the backend.

### Backend

The server calls `dotenv.config()` and reads `.env` relative to the backend process's working directory. When running the backend commands below from `backend/`, create `backend/.env` for local settings. For the starter server, `PORT` is optional and defaults to `5000`. Future database, JWT, and AI features will need server-only variables such as:

```dotenv
PORT=5000
DATABASE_URL=postgresql://<USER>:<PASSWORD>@localhost:5432/taskora?schema=public
JWT_SECRET=<generate-a-long-random-secret>
AI_API_KEY=<your-provider-key>
AI_MODEL_NAME=<provider-model-name>
```

These are variable names and placeholders, not working credentials. Do not commit `.env` files. Keep `DATABASE_URL`, `JWT_SECRET`, and AI provider keys out of frontend variables and client-side code.

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

This runs the starter server with nodemon, normally at `http://localhost:5000`. To run without nodemon:

```bash
npm start
```

At this stage the server only returns a status message from `GET /`; it does not yet expose application data APIs.

## PostgreSQL and Prisma setup

PostgreSQL and Prisma are part of the planned stack but are **not configured in the current backend**. There is no Prisma dependency, schema, migration, or database client yet.

For local preparation:

1. Install and start PostgreSQL using the instructions for your operating system.
2. Create a development database, for example by connecting with `psql` and running `CREATE DATABASE taskora;`.
3. Add a local `DATABASE_URL` to `backend/.env`, using the placeholder format shown above and your own local PostgreSQL username/password.
4. Follow the PostgreSQL/Prisma setup milestone in [BACKEND_PLAN.md](./BACKEND_PLAN.md) before running Prisma commands. Commands such as `prisma migrate dev` are not available until Prisma is installed and configured.

Use a separate database for tests and production. Never put real database credentials in source files or commit them.

## API documentation

### Currently implemented

The Express server's only route is:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Returns a JSON message indicating the starter server is running. |

Local base URL: `http://localhost:5000`. There are no task, authentication, planner, notification, or AI API endpoints yet. The frontend currently uses the mock API described above.

### Planned API areas

The backend roadmap will define and implement API contracts incrementally, beginning with registration/login and task CRUD, then Brain Dump/AI, study planning, and notifications. Request and response schemas, authentication requirements, error formats, and endpoint examples should be documented alongside each implemented API; do not treat planned routes as available endpoints.

## Testing and acceptance scenarios

The root package currently defines `npm run build`; it does not define a test script. `src/lib/api/srsAcceptance.test.ts` is present, but the README does not claim that all acceptance scenarios have been run. The backend currently has no test suite.

The original README listed the following SRS acceptance scenarios. They are retained as product checks, **not as a claim that they have all been run or that the backend supports them**. Add frontend, API, and database tests as those layers are implemented.

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

## Development roadmap

The implementation order is summarized below. Each phase has tasks, file suggestions, outcomes, testing requirements, and a checklist in [BACKEND_PLAN.md](./BACKEND_PLAN.md).

1. Backend structure and API planning
2. PostgreSQL and Prisma setup
3. Database schema and migrations
4. Registration/login, password hashing, and JWT
5. Task management CRUD APIs
6. Brain Dump and backend AI integration
7. Smart Study Planner
8. Notifications
9. Validation, error handling, and testing
10. Frontend API integration
11. Security improvements and deployment

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
