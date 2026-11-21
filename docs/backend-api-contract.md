# Taskora Backend API Contract

This document describes the backend routes currently mounted by `backend/src/app.js`.
For the complete Study Planner and Notifications field rules and examples, see
[Phase 06 Study Planner API Contract](./phase06-api-contract.md).

The frontend API in `src/lib/api/client.ts` uses HTTP adapters for the
implemented backend areas and retains local storage only for preferences and
compatibility data.

## Base URL and authentication

The local backend base URL is `http://localhost:5000`. Paths below are relative
to that host. Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

Obtain a token from `POST /api/auth/login`. Tokens are signed with `HS256`, use
issuer `taskora-api` and audience `taskora-client`, and expire after one hour.
The authenticated user ID comes from the token subject; clients must not send
`userId` to choose an owner. Registration does not return a token.

Validation errors and other client errors use:

```json
{ "error": "Readable error message" }
```

Malformed JSON returns `400` with `{"error":"Invalid JSON payload"}`. Unexpected
server errors return `500` with `{"error":"Internal server error"}`; internal
exception or database details are not included in the response.

JSON request bodies are limited to 1 MiB. Oversized JSON returns `413` with
`{"error":"Request body exceeds the supported size limit"}`; unsupported media
types on write requests carrying an `Authorization` header and a body return
`415` with
`{"error":"Unsupported content type"}`. Responses disable Express
fingerprinting and include `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
`Permissions-Policy: geolocation=(), microphone=(), camera=()`, and
`Cross-Origin-Resource-Policy: same-origin`.

## Password recovery

`POST /api/auth/forgot-password` accepts `{ "email": "student@example.com" }`
and always returns a generic `202` response for syntactically valid emails.
Known accounts receive an opaque 32-byte reset token with a SHA-256 hash stored
in the database. The token expires after 30 minutes and is invalidated after use.
`PASSWORD_RESET_TOKEN_TTL_MINUTES` configures the lifetime in minutes (default
`30`, accepted range `1`–`1440`). Only an exact, unexpired, unused token can
reset a password.

The default local `EMAIL_PROVIDER=mock` does not send mail. For Resend, configure
`EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, a provider-verified `EMAIL_FROM`,
`EMAIL_FROM_NAME`, and `PASSWORD_RESET_URL`. The backend sends a reusable
plain-text and HTML template containing a URL-encoded token. The Resend API
request is bounded by `EMAIL_DELIVERY_TIMEOUT_MS` (default 5000 ms; maximum
60000 ms).

The existing custom webhook remains available as `EMAIL_PROVIDER=webhook` with
`PASSWORD_RESET_DELIVERY_URL`. It receives the legacy `email`, `token`, and
`expiresAt` fields. If `PASSWORD_RESET_URL` is set, the webhook also receives a
reset URL and rendered message fields. Optional authorization and HMAC-SHA256
signatures use `PASSWORD_RESET_DELIVERY_AUTHORIZATION` and
`PASSWORD_RESET_DELIVERY_SIGNING_SECRET`; the legacy
`PASSWORD_RESET_DELIVERY_TIMEOUT_MS` is still accepted. Production requires an
explicit provider and HTTPS delivery/reset URLs. If delivery is not configured
or fails, the API response remains generic and does not expose account
existence, reset tokens, provider responses, or credentials.

`POST /api/auth/reset-password` accepts
`{ "token": "<64-character hex token>", "password": "<new password>" }`.
The password must contain 8–72 UTF-8 bytes. Invalid, expired or reused tokens
return `400`.

## Health and root

| Method | Path | Auth | Success |
| --- | --- | --- | --- |
| `GET` | `/` | No | `200`, `{"message":"Taskora Backend is running!"}` |
| `GET` | `/health/live` | No | `200`, `{"status":"ok"}` |
| `GET` | `/health/ready` | No | `200`, `{"status":"ready"}`; `503`, `{"status":"not_ready"}` when the database check fails |

`/health/live` checks only that the process can answer. `/health/ready` checks
database connectivity.

## Authentication

### `POST /api/auth/register`

Public. Request:

```json
{
  "name": "Alex Doe",
  "email": "alex@example.com",
  "password": "a-secure-password"
}
```

`name` is trimmed, non-empty, and at most 100 characters. `email` is trimmed,
lowercased, and must match the accepted email format (maximum 254 characters).
`password` is required and must be 8–72 UTF-8 bytes. No other fields are
accepted.

Both a completed registration and an email that cannot be registered return
`202` with the same body, to avoid disclosing account existence:

```json
{ "message": "If registration can be completed, you can now sign in." }
```

Validation failures return `400`; the shared registration/login limit returns
`429` with `{"error":"Too many authentication attempts. Please try again later."}`.
The limiter uses the process's in-memory default store.

### `POST /api/auth/login`

Public. Request:

```json
{ "email": "alex@example.com", "password": "a-secure-password" }
```

Only `email` and `password` are accepted. Email is normalized as for
registration. Invalid credentials return `401` with
`{"error":"Invalid email or password"}`.

Success (`200`):

```json
{
  "token": "<JWT>",
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Alex Doe",
    "email": "alex@example.com",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

The user response does not contain a password or frontend-only `role`, `avatar`,
or profile fields. Registration and login share a limit of 10 attempts per
15-minute window per IP in the running process.

### `GET /api/auth/me`

Protected. Returns the current safe user object:

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Alex Doe",
    "email": "alex@example.com",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Missing, invalid, expired, or no-longer-resolvable tokens return `401`.
The body is `{"error":"Authentication required"}` when the Bearer token is
missing or malformed, and `{"error":"Invalid or expired token"}` when token
verification fails or its subject no longer resolves to a user.

## Tasks

All task routes require authentication and operate only on the caller's tasks.
Task IDs must be UUIDs (`8-4-4-4-12` hexadecimal characters). A missing or
another user's task returns `404` with `{"error":"Task not found"}`.

| Method | Path | Success |
| --- | --- | --- |
| `POST` | `/api/tasks` | `201`, `{"task": ...}` |
| `GET` | `/api/tasks` | `200`, `{"tasks": [...]}` |
| `GET` | `/api/tasks/:id` | `200`, `{"task": ...}` |
| `PUT` | `/api/tasks/:id` | `200`, `{"task": ...}` |
| `DELETE` | `/api/tasks/:id` | `204`, no body |

Create example:

```json
{
  "title": "Prepare release",
  "description": "Check production readiness",
  "category": "Operations",
  "tags": ["release", "database"],
  "subtasks": [
    { "id": "migrations", "title": "Review migrations", "completed": false }
  ],
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-12-01T12:30:00Z"
}
```

`title` is required on create and must be a non-empty string; it is trimmed
and limited to 120 characters. `description` may be `null` or a non-empty,
non-whitespace string up to 1,000 characters. `category` is optional and is
limited to 64 characters. `tags` is an optional array of at most 20 non-empty
strings (64 characters each). `subtasks` is an optional array of at most 100
objects with `id`, `title`, and `completed` fields. `status` is `TODO`,
`IN_PROGRESS`, `IN_REVIEW`, or `COMPLETED`; `priority` is `LOW`, `MEDIUM`, or
`HIGH`. Omitted status, priority, category, tags and subtasks use database
defaults. `dueDate` may be
`null`, an ISO `YYYY-MM-DD` date, or an ISO date-time with a timezone offset.
A date-only value is interpreted as UTC midnight. Unsupported fields (including
`userId`) are rejected with `400`.

`PUT` is a partial update, but it must contain at least one supported field.
When changing `status` to `COMPLETED`, the backend creates one owner-scoped
`task_completed` notification on the first transition only; repeating an update
to an already completed task does not create another completion notification.

The task DTO is:

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "title": "Prepare release",
  "description": "Check production readiness",
  "category": "Operations",
  "tags": ["release", "database"],
  "subtasks": [
    { "id": "migrations", "title": "Review migrations", "completed": false }
  ],
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-12-01T12:30:00.000Z",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

Nullable `description` and `dueDate` are returned as `null`. The DTO does not
include `userId`. Invalid UUIDs or request fields return `400`; missing or
cross-user resources return `404`; unexpected errors return the generic `500`.

Validation failures return `400` using `{"error":"..."}`. Examples of the
exact messages include `"A JSON object is required"`,
`"Title must be a non-empty string"`,
`"Status must be TODO, IN_PROGRESS, IN_REVIEW, or COMPLETED"`,
`"Priority must be LOW, MEDIUM, or HIGH"`, and
`"Due date must be an ISO 8601 date or date-time, or null"`. Unsupported fields
return `"Unsupported task field: <field>"`; an empty `PUT` returns
`"At least one task field must be provided"`.

## AI Assistant

### `POST /api/ai/assistant`

Protected. Accepts a non-empty `message` string of at most 4,000 characters
and an optional owned `conversationId`:

```json
{ "message": "Help me plan my study session." }
```

When `conversationId` is omitted, success (`200`) returns assistant text:

```json
{ "response": "A text response from the assistant." }
```

When `conversationId` is supplied, the endpoint persists the user and assistant
messages and any task proposals in that owned conversation, returning `201`.
The request uses the same ownership checks and response shape as the conversation
message endpoint. Validation failures return `400`. Each authenticated user is limited to 10
requests per 15-minute window (`429` with
`{"error":"Too many AI requests. Please try again later."}`). The limiter uses
the process's in-memory default store. AI configuration failures return `503`,
provider rate limits return `429`, other provider failures return `502`, and
timeouts return `504`. These errors do not expose provider details.

Validation error examples are `"A JSON object is required"`,
`"Only the message and optional conversationId fields are accepted"`,
`"Message must be a non-empty string"`, and
`"Message must be 4000 characters or fewer"`.

### Persistent conversations and task proposals

All conversation and proposal endpoints are protected and scoped to the JWT
owner. Another user's conversation or proposal is reported as `404`.

| Method | Path | Success |
| --- | --- | --- |
| `POST` | `/api/ai/conversations` | `201`, `{ "conversation": ... }` |
| `GET` | `/api/ai/conversations` | `200`, `{ "conversations": [...] }` |
| `GET` | `/api/ai/conversations/:conversationId` | `200`, `{ "conversation": ... }` |
| `POST` | `/api/ai/conversations/:conversationId/messages` | `201`, persisted user/assistant messages and proposals |
| `POST` | `/api/ai/proposals/:proposalId/approve` | `200`, `{ "proposal": ..., "task": ... }` |
| `POST` | `/api/ai/proposals/:proposalId/reject` | `200`, `{ "proposal": ... }` |

Conversation creation accepts an optional title:

```json
{ "title": "Exam preparation" }
```

The title, if supplied, must contain 1–160 non-whitespace characters.
Conversation creation and proposal approval/rejection share a separate limit
of 30 writes per authenticated user per 15-minute window; exceeding it returns
`429` with
`{"error":"Too many conversation updates. Please try again later."}`.
Conversation writes use the process's in-memory store, so multiple replicas do
not share counters.

Sending a message accepts only a non-empty `message` string up to 4,000
characters:

```json
{ "message": "Help me prepare for biology." }
```

The message response contains `conversationId`, a persisted `userMessage`, a
persisted `assistantMessage`, and `proposals`. Proposals currently support only
`CREATE_TASK`; each has a UUID `id`, `actionType`, validated task `payload`,
`status`, `expiresAt`, and creation time. New proposals are `PENDING` and are
suggestions only; generating one never creates a task. Approval revalidates the
payload and creates the task in the same transaction that resolves the
proposal. Rejection does not create a task. Resolved proposals cannot be
approved or rejected again. Assistant proposals expire 30 days after creation;
an expired proposal returns `409` and is marked `EXPIRED`.

Message creation uses the same per-user AI request limit as
`POST /api/ai/assistant`. Invalid messages or IDs return `400`; missing or
cross-user resources return `404`; expired or already resolved proposals return
`409`. Provider configuration, timeout, rate limit, and other provider errors
use `503`, `504`, `429`, and `502` respectively.

## Brain Dump

### `POST /api/brain-dumps/process`

Protected. Accepts only a non-empty `text` string up to 8,000 characters:

```json
{ "text": "Biology exam next week; review cell structure and make flashcards." }
```

The endpoint asks the configured AI service to organize the text and validates
the result. It does not save a Brain Dump entry or create tasks. Success (`200`):

```json
{
  "summary": "Prepare for the biology exam.",
  "tasks": [
    {
      "title": "Review cell structure",
      "description": "Use the class notes.",
      "priority": "HIGH",
      "dueDate": "2026-12-01"
    }
  ]
}
```

The summary must be non-empty and at most 500 characters. There can be at most
20 proposed tasks; each has a non-empty title up to 120 characters and priority
`LOW`, `MEDIUM`, or `HIGH`. Optional description is non-empty and at most 1,000
characters; optional due date is a valid ISO date or date-time. Invalid input
returns `400`; invalid AI output returns `502`; configuration, provider, rate
limit, and timeout errors return `503`, `502`, `429`, and `504`. Each
authenticated user is limited to 5 requests per 15-minute window (`429` with
`{"error":"Too many Brain Dump requests. Please try again later."}`). The
limiter uses the process's in-memory default store.

Validation error examples are `"A JSON object is required"`,
`"Only the text field is accepted"`, `"Text must be a non-empty string"`, and
`"Text must be 8000 characters or fewer"`. If the generated result is
malformed or violates the described output schema, the endpoint returns
`502` with `{"error":"AI returned an invalid response"}`.

### Persisted Brain Dumps and task review

The stateless `/process` preview above remains available. Persisted Brain Dump
workflows use these protected, owner-scoped endpoints:

| Method | Path | Success |
| --- | --- | --- |
| `POST` | `/api/brain-dumps` | `201`, `{ "brainDump": ... }` |
| `GET` | `/api/brain-dumps` | `200`, `{ "brainDumps": [...] }` |
| `GET` | `/api/brain-dumps/:brainDumpId` | `200`, `{ "brainDump": ... }` |
| `POST` | `/api/brain-dumps/:brainDumpId/proposals/:proposalId/approve` | `200`, `{ "proposal": ..., "task": ... }` |
| `POST` | `/api/brain-dumps/:brainDumpId/proposals/:proposalId/reject` | `200`, the updated proposal |

`POST /api/brain-dumps` accepts the same `{ "text": "..." }` body and 8,000
character limit as `/process`, and shares the same per-user 5-per-15-minute
Brain Dump limit. It stores the original text, validated summary,
and validated task proposals. Proposals start as `PENDING`; tasks are created
only after explicit approval. Approval revalidates title, description,
priority, and due date, and creates the task transactionally through the task
service. Rejection and approval are single-use decisions. The list returns at
most 50 newest records. Missing or cross-user records return `404`; invalid
inputs return `400`; already resolved proposals return `409`. AI provider and
output errors retain the safe status mappings documented for `/process`.

## Study Planner and Notifications

Study Planner endpoints cover plan CRUD, stateless schedule preview, saving a
schedule, and schedule completion. Notifications are read and mutated through
owner-scoped authenticated endpoints; there is no public notification-create
route. Study plan dates and completion occurrence dates are civil dates
formatted as `YYYY-MM-DD`; recurring study schedules use the plan's IANA
timezone, defaulting to `Asia/Colombo`. The detailed request fields, response
examples, validation rules, timezone behavior, and error codes are documented in
[Phase 06 Study Planner API Contract](./phase06-api-contract.md).

## Product APIs

The following APIs require authentication and use the authenticated user as
the data owner.

### Habits

- `GET /api/habits` and `POST /api/habits` list and create owned habits.
- `PUT /api/habits/:id/check-ins` accepts
  `{ "date": "YYYY-MM-DD", "checked": true|false }`. It is idempotent and
  validates the date as a real calendar date. `DELETE /api/habits/:id` deletes
  only an owned habit.

### Notes

- `GET/POST /api/notes`, `PUT/DELETE /api/notes/:id` are owner-scoped.
- Notes default to private. Setting `isPrivate` to `false` creates or retains
  an unguessable share code; restoring privacy clears the code.
- `GET /api/notes/shared/:shareCode` is public and returns only the shared
  note's ID, title, content, subject name, tags, and update time. Private notes
  and invalid codes return `404`.

### Flashcards

- Deck and card operations are authenticated and owner-scoped. Review accepts
  an integer quality from `0` to `5`; other values return `400`.
- `POST /api/flashcards/cards/:cardId/review` reviews a card. The compatible
  `POST /api/flashcards/:cardId/review` path is also available. Successful
  reviews update the SM-2 repetition count, ease factor, interval, review
  count, last-reviewed time, and `dueAt` (the next review date).

### Focus sessions and XP

- `POST /api/focus/sessions/start` accepts a subject and an integer duration
  from 1 to 1440 minutes and returns a user-bound signed session token that
  expires after 24 hours.
- `POST /api/focus/sessions` accepts only `{ "sessionToken": "..." }`.
  The backend checks the signature, user, expiry, elapsed server time, and
  overlap with prior sessions before persisting a session and awarding XP in
  one transaction. Replaying a completed token returns the stored session
  with `200` and does not award XP again. Early and overlapping completions
  return `409`.
- `POST /api/focus-sessions` accepts the same completion payload and provides
  a compatibility route for clients using the hyphenated path.
- `GET /api/focus/sessions` lists the caller's completed sessions.
- `GET /api/focus-sessions/today` returns `{ "date", "timeZone",
  "totalFocusMinutes" }` for the authenticated caller. The caller can provide
  an IANA zone with `?timeZone=America%2FNew_York`; the current `User` model
  does not persist a time zone, so the endpoint defaults to UTC when omitted.
  It uses an inclusive start and exclusive next-day boundary, including
  daylight-saving transitions.

Client-submitted XP amounts and arbitrary XP writes are not accepted.

### Study rooms, gamification, analytics, search, and administration

Study rooms are available through `/api/study-rooms`; joining private rooms
requires the passcode. `GET /api/study-rooms/:id/events` is an authenticated
member-only SSE stream. Room event delivery is process-local.

`GET /api/gamification` derives achievement progress and XP from persisted
records. There is no client-write XP endpoint. `GET /api/analytics` supports
`period=7d`, `30d`, or `semester`. `GET /api/search?q=...` searches only the
authenticated user's tasks, notes, and habits.

Admin metrics, moderation reports, and audit logs are exposed under
`/api/admin/*` and enforce the `ADMIN` role on the server. No user-directory or
role-management API is currently provided.

## Frontend integration status

The frontend API client is now backend-backed for authentication, tasks,
Study Planner/calendar operations, AI conversations, persisted Brain Dumps,
notifications, habits, notes, focus sessions, study rooms, gamification
summaries, analytics and unified search. Browser `localStorage` remains only
for theme/dashboard preference fallbacks and legacy compatibility data.

Client DTO adapters map the backend task enums and notification types into the
existing React types. Task category, tags, subtasks, and all four task states
are persisted. The frontend must not send `userId` or other unsupported fields.

Password recovery uses opaque persisted reset tokens. Study rooms provide
persisted creation, passcode join and chat plus same-process Server-Sent Event
synchronization through `GET /api/study-rooms/:id/events`. Multi-instance
deployment requires a shared pub/sub broker before this feature can be treated
as cross-replicas real-time. Administrative moderation and audit-log endpoints
are persisted and enforce the server-side `ADMIN` role.
