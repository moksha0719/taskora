# Taskora deployment guide

This guide deploys the current application as a static Vite frontend on Vercel,
an Express API and PostgreSQL database on Railway, with GitHub as the source
repository and `taskora.com` as the frontend domain.

The frontend is a mix of backend-integrated features and prototypes. Authentication
and Study Planner features use the API; several other screens still use mock data
or browser storage. Deployment does not make those features persistent or add
server-side authorization to the admin UI.

## 1. Deploy PostgreSQL and the API on Railway

1. Connect the GitHub repository to a new Railway project.
2. Add a Railway PostgreSQL service. Use its private `DATABASE_URL` for the API;
   do not expose the database publicly unless an external client specifically
   requires it.
3. Add a backend service from the same repository. Set its root directory to the
   directory containing the backend `Dockerfile` and `prisma/` directory. In
   this workspace that is `taskora/backend` relative to the repository root
   (or `backend` if `taskora/` is the repository root). Railway detects and
   builds the production target in `backend/Dockerfile`.
4. Configure these backend service variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Reference the PostgreSQL service's private URL, for example `${{Postgres.DATABASE_URL}}`. Replace `Postgres` with the exact Railway service name. |
   | `JWT_SECRET` | A newly generated secret of at least 32 bytes. Store it as a Railway secret; do not reuse a local or example value. |
   | `CORS_ALLOWED_ORIGINS` | `https://taskora.com` after the Vercel domain is attached. Add another exact origin, comma-separated, only if the frontend is also served from it. |
   | `TRUST_PROXY_HOPS` | `1`, so Express uses the client IP forwarded by Railway for IP-based rate limits. |
   | `GEMINI_API_KEY` | Optional; required only for Gemini-backed features. Store as a secret. |
   | `GEMINI_MODEL` | Optional; set to a supported model when using Gemini-backed features. |

   Let Railway provide `PORT`; the server reads it automatically. Do not set
   `DATABASE_URL` to a public database URL when Railway private networking is
   available.

5. In the backend service's deployment settings, set the health check path to
   `/health/ready`. Set the pre-deploy command to `npm run db:deploy`. This runs
   Prisma migrations before the new application version starts and fails the
   deployment if migration fails. The application start command must remain
   the Dockerfile default (`node src/server.js`); do not run migrations in the
   application start command or independently in each replica.
6. Deploy the backend and confirm both `GET /health/live` and
   `GET /health/ready` return `200`. Railway can assign a temporary public
   domain for initial checks.
7. Add the custom backend domain `api.taskora.com` in Railway's networking
   settings. Configure the DNS record exactly as Railway instructs. After DNS
   and TLS are ready, verify `https://api.taskora.com/health/ready`.

Before applying production migrations to an existing database, confirm backups
or point-in-time recovery are enabled and review the pending migration set.
Before public launch, also review the backend production dependency audit:
`npm audit --omit=dev` currently reports 4 high-severity findings in the Prisma
CLI dependency tree. Its suggested automatic fix is a breaking Prisma major
upgrade; do not apply it without a migration plan.

## 2. Deploy the frontend on Vercel

1. Import the same GitHub repository as a Vercel project.
2. Set the project root directory to the directory containing the frontend
   `package.json`, `vite.config.ts`, and `vercel.json`. In this workspace that
   is `taskora` relative to the repository root (or `.` if `taskora/` is the
   repository root).
3. Use the Vite framework preset and these build settings:

   | Setting | Value |
   | --- | --- |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Install command | `npm ci` |
   | Node.js version | `22.x` |

   The checked-in `vercel.json` rewrites client-side routes to the Vite app, so
   direct visits and refreshes on paths such as `/dashboard` work.
4. Add the Vercel environment variable `VITE_API_BASE_URL` with the value
   `https://api.taskora.com` for Production. This value is embedded in the
   frontend at build time and is public; do not put secrets in `VITE_` variables.
   Redeploy after changing it.
5. Deploy and confirm the app loads and its browser requests go to
   `https://api.taskora.com`, not `localhost`.
6. Add `taskora.com` in Vercel's Domains settings and apply the DNS records
   Vercel gives you at the domain's DNS provider. Optionally add `www.taskora.com`
   and configure it to redirect to the apex domain. If both origins serve the
   app without redirecting, add both exact HTTPS origins to
   `CORS_ALLOWED_ORIGINS` on Railway.
7. After DNS and certificates are active, set the Railway CORS allowlist to the
   final frontend origin and redeploy the backend if needed:

   ```text
   CORS_ALLOWED_ORIGINS=https://taskora.com
   ```

   Do not use `*` or an unrestricted list of Vercel preview domains. For preview
   testing, use a known staging frontend origin and allowlist that exact origin.

## 3. Verify the deployment

- `https://api.taskora.com/health/live` returns `200`.
- `https://api.taskora.com/health/ready` returns `200` with the Railway database
  reachable.
- `https://taskora.com` loads, and refreshing a nested route still serves the app.
- Registration and login complete from the production frontend without CORS
  errors; authenticated API calls use the production API URL.
- Railway logs show a successful pre-deploy migration and a healthy backend.
- No production secret is present in Vercel frontend variables, committed files,
  or browser requests.

For ongoing releases, deploy the API after its migrations pass, then deploy the
frontend. Review database migrations and backups before schema changes. The
backend's `/health/ready` endpoint checks database connectivity, not migration
state.
