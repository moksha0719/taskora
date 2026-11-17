# Phase 06 Study Planner API Contract

For authentication, task, AI Assistant, Brain Dump, health, and frontend compatibility details, see the [Taskora Backend API Contract](./backend-api-contract.md).

Base path: `/api/study-plans`

All endpoints below require a valid JWT:

```http
Authorization: Bearer <JWT>
```

The study-plan router applies authentication to every endpoint. Middleware verifies the JWT with `HS256`, issuer `taskora-api`, and audience `taskora-client`; the token must be unexpired and have a string `sub` claim. That `sub` becomes `req.user.id`. Clients must not send a `userId` to establish ownership.

## Endpoints

| Method | Path | Success |
| --- | --- | --- |
| `POST` | `/api/study-plans` | `201`, `{ "studyPlan": ... }` |
| `GET` | `/api/study-plans` | `200`, `{ "studyPlans": [...] }` |
| `GET` | `/api/study-plans/active` | `200`, `{ "studyPlan": ... }` or `{ "studyPlan": null }` |
| `GET` | `/api/study-plans/:id` | `200`, `{ "studyPlan": ... }` |
| `PUT` | `/api/study-plans/:id` | `200`, `{ "studyPlan": ... }` |
| `DELETE` | `/api/study-plans/:id` | `204`, no response body |
| `PUT` | `/api/study-plans/:id/schedule` | `200`, `{ "studyPlan": ... }` |
| `POST` | `/api/study-plans/generate` | `200`, `{ "schedule": [...] }` |
| `GET` | `/api/study-plans/:planId/completions?from=YYYY-MM-DD&to=YYYY-MM-DD` | `200`, `{ "completions": [...] }` |
| `PUT` | `/api/study-plans/:planId/schedule-items/:itemId/completions/:date` | `200`, `{ "completion": ... }` |
| `DELETE` | `/api/study-plans/:planId/schedule-items/:itemId/completions/:date` | `200`, `{ "completion": ..., "deleted": true }` |

`/active` and `/generate` are static paths, not plan IDs. Plan and schedule-item IDs in paths must match the UUID shape `8-4-4-4-12` hexadecimal characters.

## Study plan create and update

`POST /api/study-plans` creates a `DRAFT` plan. `PUT /api/study-plans/:id` accepts a complete replacement payload, not a partial update, and is allowed only while the plan is `DRAFT`. The supplied subjects replace the existing subjects.

```json
{
  "title": "Fall Semester Plan",
  "startDate": "2026-11-16",
  "endDate": "2026-12-20",
  "timeZone": "Asia/Colombo",
  "weeklyTargetMinutes": 600,
  "studyDaysPerWeek": 4,
  "subjects": [
    {
      "name": "Mathematics",
      "targetMinutesPerWeek": 600,
      "code": "MATH",
      "color": "#9885E8"
    }
  ]
}
```

### Fields and validation

Required plan fields:

- `title`: non-empty string; trimmed.
- `startDate`, `endDate`: valid `YYYY-MM-DD` dates; end date must be on or after start date.
- `weeklyTargetMinutes`: integer from `600` through `2400`.
- `studyDaysPerWeek`: `4`, `5`, or `6`.
- `subjects`: non-empty array.

Optional plan field:

- `timeZone`: valid, trimmed IANA timezone string. Defaults to `Asia/Colombo`.

Plan `startDate` and `endDate` are civil dates and are returned as
`YYYY-MM-DD`, without a time or UTC offset. Weekly schedule recurrences use
the plan's IANA timezone; when omitted, that timezone defaults to
`Asia/Colombo`.

Each subject requires:

- `name`: non-empty string; trimmed and unique case-insensitively within the plan.
- `targetMinutesPerWeek`: positive safe integer.

Optional subject fields:

- `code`: string; trimmed. If omitted, the service stores `""`.
- `color`: six-digit hex color such as `#9885E8`; if omitted, the service stores `#9885E8`.

The sum of all `subjects[].targetMinutesPerWeek` values must equal `weeklyTargetMinutes`. `userId`, `status`, and other unsupported fields are rejected.

Successful create and update responses contain the persisted plan and its subjects. A plan includes the schema scalar fields `id`, `userId`, `activeUserId`, `title`, `status`, `startDate`, `endDate`, `timeZone`, `weeklyTargetMinutes`, `studyDaysPerWeek`, `createdAt`, and `updatedAt`. Plan `startDate` and `endDate` are serialized as civil dates in `YYYY-MM-DD` format; `createdAt` and `updatedAt` remain UTC ISO timestamps.

Example create response (IDs and timestamps are illustrative):

```json
{
  "studyPlan": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "userId": "11111111-1111-4111-8111-111111111111",
    "activeUserId": null,
    "title": "Fall Semester Plan",
    "status": "DRAFT",
    "startDate": "2026-11-16",
    "endDate": "2026-12-20",
    "timeZone": "Asia/Colombo",
    "weeklyTargetMinutes": 600,
    "studyDaysPerWeek": 4,
    "createdAt": "2026-11-16T12:00:00.000Z",
    "updatedAt": "2026-11-16T12:00:00.000Z",
    "subjects": [
      {
        "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "planId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "name": "Mathematics",
        "code": "MATH",
        "color": "#9885E8",
        "targetMinutesPerWeek": 600
      }
    ]
  }
}
```

`GET /api/study-plans` returns only the caller's plans, each with its subjects. `GET /api/study-plans/active` returns the caller's active plan with subjects and their schedule items, or `null`. `GET /api/study-plans/:id` returns an owned plan with subjects and schedule items. Schedule items include their schema scalar fields, including `dayOfWeek`, `startMinuteOfDay`, `durationMinutes`, `kind`, and `topics`; completion records are not included in these responses.

`DELETE /api/study-plans/:id` deletes only `DRAFT` or `ARCHIVED` plans. `ACTIVE` plans cannot be deleted. This API has no activation endpoint; clients cannot change a plan's status via create or update.

## Schedule generation preview

`POST /api/study-plans/generate` accepts exactly these top-level fields, all required: `plan`, `subjects`, `studyDays`, and `scheduleSettings`. It returns an in-memory preview only and does not persist schedule items.

```json
{
  "plan": {
    "weeklyTargetMinutes": 600,
    "studyDaysPerWeek": 4
  },
  "subjects": [
    {
      "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "name": "Mathematics",
      "targetMinutesPerWeek": 600
    }
  ],
  "studyDays": ["MON", "TUE", "WED", "THU"],
  "scheduleSettings": {
    "availabilityWindows": [
      { "dayOfWeek": "MON", "startMinuteOfDay": 540, "endMinuteOfDay": 900 },
      { "dayOfWeek": "TUE", "startMinuteOfDay": 540, "endMinuteOfDay": 900 },
      { "dayOfWeek": "WED", "startMinuteOfDay": 540, "endMinuteOfDay": 900 },
      { "dayOfWeek": "THU", "startMinuteOfDay": 540, "endMinuteOfDay": 900 }
    ]
  }
}
```

Generation validation:

- `plan.weeklyTargetMinutes`: integer from `600` through `2400`.
- `plan.studyDaysPerWeek`: `4`, `5`, or `6`.
- `subjects`: non-empty; each subject has a non-empty `id`, non-empty `name`, and positive safe-integer `targetMinutesPerWeek`. IDs must be unique and targets must sum to the plan's weekly target.
- `studyDays`: unique `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`, `SUN` values; the number of days must equal `plan.studyDaysPerWeek`.
- `scheduleSettings.availabilityWindows`: required and non-empty. Every selected study day needs at least one window. Each window has `dayOfWeek`, `startMinuteOfDay` (`0`–`1439`) and `endMinuteOfDay` (greater than start and at most `1440`). Windows cannot overlap and must refer to selected days. Combined supplied availability must be enough for the weekly target.

The response contains sessions shaped as follows:

```json
{
  "schedule": [
    {
      "subjectId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "subjectName": "Mathematics",
      "dayOfWeek": "MON",
      "startMinuteOfDay": 540,
      "durationMinutes": 150,
      "kind": "STUDY"
    }
  ]
}
```

Durations are between 1 and 150 minutes. Generated sessions do not overlap, stay inside their supplied windows and sum to each subject's weekly target. The output uses `kind: "STUDY"`; review-session rules are not implemented.

Availability must be supplied by the caller; the backend does not infer a user's free time. The preview service treats the supplied minute-of-day values as local clock values without converting time zones. Persisted schedule reminders use the plan's IANA `timeZone` to interpret a weekday and minute-of-day as local time.

## Persisting a generated schedule

Schedule generation is preview-only. To save that schedule to an owned plan, send the preview's `schedule` array to:

```http
PUT /api/study-plans/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/schedule
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "schedule": [
    {
      "subjectId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "subjectName": "Mathematics",
      "dayOfWeek": "MON",
      "startMinuteOfDay": 540,
      "durationMinutes": 150,
      "kind": "STUDY"
    },
    {
      "subjectId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "subjectName": "Mathematics",
      "dayOfWeek": "TUE",
      "startMinuteOfDay": 540,
      "durationMinutes": 150,
      "kind": "STUDY"
    },
    {
      "subjectId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "subjectName": "Mathematics",
      "dayOfWeek": "WED",
      "startMinuteOfDay": 540,
      "durationMinutes": 150,
      "kind": "STUDY"
    },
    {
      "subjectId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "subjectName": "Mathematics",
      "dayOfWeek": "THU",
      "startMinuteOfDay": 540,
      "durationMinutes": 150,
      "kind": "STUDY"
    }
  ]
}
```

The schedule must contain at least one session. Every session requires a UUID `subjectId` belonging to the target plan, a valid `dayOfWeek`, `startMinuteOfDay` from `0` to `1439`, `durationMinutes` from `1` to `150`, and `kind: "STUDY"`. `subjectName` is optional; if supplied, it must match the current subject name. Unsupported fields are rejected.

The complete schedule must:

- Use exactly `studyDaysPerWeek` distinct days.
- Sum to each plan subject's `targetMinutesPerWeek` exactly.
- Have no overlapping sessions on the same day.
- Keep each session within the same day (start plus duration no greater than `1440`).

Saving replaces the plan's existing schedule in a transaction. The plan must belong to the caller and must not be `ARCHIVED`. A schedule with recorded completions cannot be replaced. The response is `{ "studyPlan": ... }` with the persisted subjects and schedule items. Another user's or missing plan returns `404`; an archived plan or schedule with completions returns `409`; malformed or inconsistent schedules return `400`.

The schedule-save API does not activate a plan. The current backend has no plan activation endpoint.

## Schedule completion

### Listing completion history

`GET /api/study-plans/:planId/completions` returns completions for schedule
items belonging to the caller's plan. Both query parameters are required,
strict `YYYY-MM-DD` calendar dates. The range includes `from` and excludes
`to`; `to` must be after `from`.

```http
GET /api/study-plans/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/completions?from=2026-11-16&to=2026-11-23
Authorization: Bearer <JWT>
```

Success (`200`), ordered by occurrence date and then schedule-item ID:

```json
{
  "completions": [
    {
      "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "scheduleItemId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "occurrenceDate": "2026-11-16",
      "completedAt": "2026-11-16T12:00:00.000Z",
      "actualDurationMinutes": 45
    }
  ]
}
```

`occurrenceDate` is a civil date returned as `YYYY-MM-DD`, not an instant.
`completedAt` remains a UTC ISO timestamp. If no records match, the response
is `{ "completions": [] }`. Malformed plan IDs return `400`; well-formed but
nonexistent plans and plans belonging to another user return `404`. Invalid
dates, a non-increasing range, or unsupported query parameters return `400`.
Authentication is required.

The date is in the URL, not the body. `PUT` creates a completion or updates the existing completion for the same schedule item and date.

```http
PUT /api/study-plans/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/schedule-items/cccccccc-cccc-4ccc-8ccc-cccccccccccc/completions/2026-11-16
Content-Type: application/json
```

```json
{
  "actualDurationMinutes": 45
}
```

`actualDurationMinutes` is optional or may be `null`; if provided as a number, it must be a positive integer no greater than `2147483647`. An omitted value is stored as `null`. No other body fields are accepted.

Successful `PUT` response:

```json
{
  "completion": {
    "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "scheduleItemId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "occurrenceDate": "2026-11-16",
    "completedAt": "2026-11-16T12:00:00.000Z",
    "actualDurationMinutes": 45
  }
}
```

For `PUT`, the `date` path parameter must be a real `YYYY-MM-DD` calendar date
within the plan's inclusive `startDate` and `endDate` range. Occurrences on
either boundary date are accepted; dates outside the plan range return `400`.
`DELETE` does not use a request body and returns the deleted key, with the
occurrence date in the same civil-date format:

```json
{
  "completion": {
    "scheduleItemId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "occurrenceDate": "2026-11-16"
  },
  "deleted": true
}
```

The service verifies that the plan belongs to the authenticated user and that the schedule item belongs to that plan. A plan or item that is missing, belongs to another user, or belongs to another plan is reported as not found. The schema's unique constraint is `(scheduleItemId, occurrenceDate)`. The service does not additionally require the occurrence date to match the item's weekday.

## Notifications

All notification endpoints use the JWT authentication described above. Notification list and mutation operations are always scoped to `req.user.id`; clients cannot create notifications or select another user's notifications.

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/api/notifications` | `200`, `{ "notifications": [...], "pagination": {...} }` |
| `GET` | `/api/notifications/unread-count` | `200`, `{ "unreadCount": 0 }` |
| `PATCH` | `/api/notifications/read-all` | `200`, `{ "updatedCount": 0 }` |
| `PATCH` | `/api/notifications/:id/read` | `200`, `{ "notification": ... }` |
| `DELETE` | `/api/notifications/:id` | `204`, no response body |

`GET /api/notifications` accepts only these query parameters:

| Parameter | Optional | Validation/default |
| --- | --- | --- |
| `type` | Yes | One of `task_due`, `task_completed`, `study_reminder`, `study_plan_updated`, `system`. |
| `unreadOnly` | Yes | Exactly `true` or `false`; defaults to `false`. |
| `page` | Yes | Positive integer; defaults to `1`. |
| `limit` | Yes | Positive integer up to `100`; defaults to `20`. |

Unknown query parameters and malformed values return `400`. Notifications are ordered newest first, with ID as a stable tie-breaker. Example:

```http
GET /api/notifications?type=task_due&unreadOnly=true&page=1&limit=20
Authorization: Bearer <JWT>
```

```json
{
  "notifications": [
    {
      "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "userId": "11111111-1111-4111-8111-111111111111",
      "type": "task_due",
      "title": "Task due soon",
      "message": "Finish assignment is due within 24 hours.",
      "read": false,
      "actionUrl": "/tasks/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "createdAt": "2026-11-16T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

`PATCH /api/notifications/:id/read` and `PATCH /api/notifications/read-all` take no body. Marking one notification read is idempotent; the response contains the notification with `"read": true`. The mark-all response's `updatedCount` is the number of unread notifications changed. `DELETE /api/notifications/:id` returns `204`; a missing or another user's ID returns `404`.

Notification fields are `id`, `userId`, `type`, `title`, `message`, `read`, `actionUrl`, and `createdAt`. `actionUrl` is either `null` or a local application path beginning with a single `/`. There is intentionally no public notification-create endpoint.

The backend creates these notifications internally:

- `task_completed`: when an owned task changes to `COMPLETED`; repeated updates to an already-completed task do not create another event notification.
- `study_plan_updated`: after an owned `DRAFT` plan update commits.
- `task_due`: for non-completed tasks due within the next 24 hours.
- `study_reminder`: 15 minutes before a persisted weekly schedule item, only
  when the candidate occurrence's local date in the plan timezone falls
  within the inclusive plan start/end dates.
- `system`: supported as a notification type for trusted internal backend use; no public client creation route exists.

Due-task and study-session reminders are checked by the backend scheduler once per minute. Database-unique deduplication keys prevent repeats across scheduler runs and concurrent instances. Study reminders are based only on saved schedule items, never on a preview. The scheduler interprets recurring weekdays and minute-of-day values in the study plan's IANA timezone, defaulting to `Asia/Colombo`, and enforces the inclusive plan date range using that timezone's local date. A local time that does not exist during a daylight-saving transition is skipped. Task due dates are stored as instants; date-only task inputs are interpreted as UTC midnight because tasks have no timezone field.

## Errors and status codes

Error responses use this JSON shape:

```json
{ "error": "Readable error message" }
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid request body, unsupported field, invalid UUID/date/duration, or other validation failure. Invalid JSON also returns `400` with `{"error":"Invalid JSON payload"}`. |
| `401` | Missing, invalid, or expired JWT. |
| `404` | Plan, schedule item, or completion does not exist for the authenticated user's requested resource. Cross-user access is not disclosed separately. |
| `409` | Plan is not in an allowed state for update/delete, or a handled Prisma unique-constraint conflict. |
| `422` | Schedule request is valid but supplied availability cannot fit its weekly target. |
| `500` | Unexpected internal error; response is always `{"error":"Internal server error"}`. |

Plan deletion is the successful operation that returns no body (`204`).

## Ownership and authorization

- Every endpoint is behind JWT authentication.
- Plan create associates the plan with the authenticated user; `userId` and `status` cannot be set in the request.
- List, active lookup, read, update, and delete are scoped to the authenticated user.
- Schedule completion operations verify both plan ownership and schedule-item membership in that plan before writing or deleting.
- Schedule preview is stateless and does not persist anything. Its top-level request does not accept a client-supplied `userId`.
- Schedule persistence, completion, and notification routes derive ownership only from the JWT's subject claim.
- Notification reads, updates, and deletes include the authenticated user ID in their database filters. Repeated scheduler runs are protected by a unique deduplication key.
