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

`title` is required on create and must be a non-empty string; it is trimmed.
`description` may be a string or `null`. `status` is `TODO`, `IN_PROGRESS`, or
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
`AIProposal`, persist proposed tasks, or provide proposal approval endpoints.
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

## Study Planner and Notifications

Study Planner endpoints cover plan CRUD, stateless schedule preview, saving a
schedule, and schedule completion. Notifications are read and mutated through
owner-scoped authenticated endpoints; there is no public notification-create
route. The detailed request fields, response examples, validation rules,
timezone behavior, and error codes are documented in
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
- Frontend AI proposal and Brain Dump flows are local mock workflows. Backend
  assistant and Brain Dump routes return plain assistant text or validated
  proposed tasks and do not implement proposal approval or persistence.

Do not treat these mismatches as implicit API changes. The frontend integration
should map deliberately to the documented backend contract or agree on a
versioned contract update.
