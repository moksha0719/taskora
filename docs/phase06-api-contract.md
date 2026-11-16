# Phase 06 Study Planner API Contract

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
| `POST` | `/api/study-plans/generate` | `200`, `{ "schedule": [...] }` |
| `PUT` | `/api/study-plans/:planId/schedule-items/:itemId/completions/:date` | `200`, `{ "completion": ... }` |
| `DELETE` | `/api/study-plans/:planId/schedule-items/:itemId/completions/:date` | `200`, `{ "completion": ..., "deleted": true }` |

`/active` is a static path, not a plan ID. Plan and schedule-item IDs in paths must match the UUID shape `8-4-4-4-12` hexadecimal characters.

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

Each subject requires:

- `name`: non-empty string; trimmed and unique case-insensitively within the plan.
- `targetMinutesPerWeek`: positive safe integer.

Optional subject fields:

- `code`: string; trimmed. If omitted, the service stores `""`.
- `color`: six-digit hex color such as `#9885E8`; if omitted, the service stores `#9885E8`.

The sum of all `subjects[].targetMinutesPerWeek` values must equal `weeklyTargetMinutes`. `userId`, `status`, and other unsupported fields are rejected.

Successful create and update responses contain the persisted plan and its subjects. A plan includes the schema scalar fields `id`, `userId`, `activeUserId`, `title`, `status`, `startDate`, `endDate`, `timeZone`, `weeklyTargetMinutes`, `studyDaysPerWeek`, `createdAt`, and `updatedAt`. Prisma dates serialize as ISO date-time strings in JSON; for example, a stored date-only value is returned at UTC midnight.

Example create response (IDs and timestamps are illustrative):

```json
{
  "studyPlan": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "userId": "11111111-1111-4111-8111-111111111111",
    "activeUserId": null,
    "title": "Fall Semester Plan",
    "status": "DRAFT",
    "startDate": "2026-11-16T00:00:00.000Z",
    "endDate": "2026-12-20T00:00:00.000Z",
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

Availability must be supplied by the caller; the backend does not infer a user's free time. The plan's `timeZone` is validated and stored by plan CRUD, but the generation service does not read it or define a timezone conversion for availability windows. The frontend and backend still need an agreed timezone interpretation for those minute-of-day values.

## Schedule completion

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
    "occurrenceDate": "2026-11-16T00:00:00.000Z",
    "completedAt": "2026-11-16T12:00:00.000Z",
    "actualDurationMinutes": 45
  }
}
```

The `date` path parameter must be a real `YYYY-MM-DD` calendar date. `DELETE` does not use a request body and returns the deleted key:

```json
{
  "completion": {
    "scheduleItemId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "occurrenceDate": "2026-11-16T00:00:00.000Z"
  },
  "deleted": true
}
```

The service verifies that the plan belongs to the authenticated user and that the schedule item belongs to that plan. A plan or item that is missing, belongs to another user, or belongs to another plan is reported as not found. The schema's unique constraint is `(scheduleItemId, occurrenceDate)`. The service does not additionally require the occurrence date to fall within the plan's start/end dates or to match the item's weekday.

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
