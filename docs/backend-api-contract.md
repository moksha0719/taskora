# Taskora Backend API Contract

This document describes the backend routes currently mounted by `backend/src/app.js`.
For the complete Study Planner and Notifications field rules and examples, see
[Phase 06 Study Planner API Contract](./phase06-api-contract.md).

The frontend API in `src/lib/api/client.ts` is still a local-storage mock. These
backend endpoints do not currently back the frontend UI.

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
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-12-01T12:30:00Z"
}
```

`title` is required on create and must be a non-empty string; it is trimmed
and limited to 120 characters. `description` may be `null` or a non-empty,
non-whitespace string up to 1,000 characters. `status` is `TODO`, `IN_PROGRESS`, or
`COMPLETED`; `priority` is `LOW`, `MEDIUM`, or `HIGH`. Omitted status and
priority use the database defaults (`TODO` and `MEDIUM`). `dueDate` may be
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
`"Status must be TODO, IN_PROGRESS, or COMPLETED"`,
`"Priority must be LOW, MEDIUM, or HIGH"`, and
`"Due date must be an ISO 8601 date or date-time, or null"`. Unsupported fields
return `"Unsupported task field: <field>"`; an empty `PUT` returns
`"At least one task field must be provided"`.

## AI Assistant

### `POST /api/ai/assistant`

Protected. Accepts only a non-empty `message` string of at most 4,000
characters:

```json
{ "message": "Help me plan my study session." }
```

Success (`200`):

```json
{ "response": "A text response from the assistant." }
```

This endpoint returns assistant text; it does not create a frontend
`AIProposal` or persist messages. Persistent conversations and explicit
task-proposal approval are available through the conversation endpoints below.
Validation failures return `400`. Each authenticated user is limited to 10
requests per 15-minute window (`429` with
`{"error":"Too many AI requests. Please try again later."}`). The limiter uses
the process's in-memory default store. AI configuration failures return `503`,
provider failures return `502`, and timeouts return `504`. These errors do not
expose provider details.

Validation error examples are `"A JSON object is required"`,
`"Only the message field is accepted"`,
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
`409`. Provider configuration, timeout, and provider errors use `503`, `504`,
and `502` respectively.

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
returns `400`; invalid AI output returns `502`; configuration, provider, and
timeout errors return `503`, `502`, and `504`. Each authenticated user is
limited to 5 requests per 15-minute window (`429` with
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

## Frontend integration status

The current frontend `src/lib/api/client.ts` functions use mock data and
`localStorage`; they do not call these HTTP routes. Before connecting the
frontend, its API client and DTOs need an intentional compatibility update:

- Authentication currently accepts a role rather than a password, returns a
  mock `User`, and stores no JWT. Backend login requires email/password and
  returns `{ token, user }`; registration requires a password and returns a
  generic message without a user or token. The frontend `User` includes
  `role`, `avatar`, and `joinedAt`, which the backend user DTO does not.
- Frontend task statuses are lowercase and include `in_review`; priorities
  include `urgent`. The backend uses uppercase enums and supports only
  `TODO`, `IN_PROGRESS`, `COMPLETED`, `LOW`, `MEDIUM`, and `HIGH`. Frontend
  tasks also include category, tags, subtasks, and time-tracking fields not
  present in the backend DTO. Mock IDs such as `tsk_...` are not backend UUIDs.
- The frontend Study Plan uses weekly hours and a `sessions` shape. The backend
  uses minute targets, plan/subject UUIDs, persisted schedule items, and
  explicit `availabilityWindows` for preview generation. See the Phase 06
  contract before adapting this flow.
- Frontend notification type names are `deadline`, `habit`, `room`, `system`,
  and `achievement`; backend values are `task_due`, `task_completed`,
  `study_reminder`, `study_plan_updated`, and `system`. The current frontend
  mock exposes list and mark-read methods only; the backend also supports
  pagination, filters, unread count, and deletion.
- Frontend AI proposal and Brain Dump flows remain local mock workflows and
  are not connected to these APIs. The backend supports persistent AI
  conversations, explicit task-proposal approval, and persisted Brain Dump
  review. The legacy `/api/ai/assistant` and `/api/brain-dumps/process`
  endpoints remain stateless preview operations.

Do not treat these mismatches as implicit API changes. The frontend integration
should map deliberately to the documented backend contract or agree on a
versioned contract update.
