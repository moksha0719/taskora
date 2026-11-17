const TASK_STATUSES = new Set(["TODO", "IN_PROGRESS", "COMPLETED"]);
const TASK_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const TASK_FIELDS = new Set(["title", "description", "status", "priority", "dueDate"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;
const MAX_TASK_TITLE_LENGTH = 120;
const MAX_TASK_DESCRIPTION_LENGTH = 1000;

function validateTaskInput(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "A JSON object is required" };
    }

    const keys = Object.keys(body);
    const unknownField = keys.find((key) => !TASK_FIELDS.has(key));
    if (unknownField) {
        return { error: `Unsupported task field: ${unknownField}` };
    }

    if (partial && keys.length === 0) {
        return { error: "At least one task field must be provided" };
    }

    if (
        (!partial || Object.hasOwn(body, "title")) &&
        (typeof body.title !== "string" || !body.title.trim())
    ) {
        return { error: "Title must be a non-empty string" };
    }

    if (
        (!partial || Object.hasOwn(body, "title")) &&
        typeof body.title === "string" &&
        body.title.trim().length > MAX_TASK_TITLE_LENGTH
    ) {
        return { error: `Title must be ${MAX_TASK_TITLE_LENGTH} characters or fewer` };
    }

    const data = {};
    for (const field of keys) {
        const value = body[field];

        if (field === "title") {
            data.title = value.trim();
        } else if (field === "description") {
            if (value !== null && typeof value !== "string") {
                return { error: "Description must be a string or null" };
            }
            if (typeof value === "string" && !value.trim()) {
                return { error: "Description must not be empty or whitespace only" };
            }
            if (typeof value === "string" && value.trim().length > MAX_TASK_DESCRIPTION_LENGTH) {
                return { error: `Description must be ${MAX_TASK_DESCRIPTION_LENGTH} characters or fewer` };
            }
            data.description = value;
        } else if (field === "status") {
            if (!TASK_STATUSES.has(value)) {
                return { error: "Status must be TODO, IN_PROGRESS, or COMPLETED" };
            }
            data.status = value;
        } else if (field === "priority") {
            if (!TASK_PRIORITIES.has(value)) {
                return { error: "Priority must be LOW, MEDIUM, or HIGH" };
            }
            data.priority = value;
        } else if (field === "dueDate") {
            if (value === null) {
                data.dueDate = null;
                continue;
            }

            if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
                return { error: "Due date must be an ISO 8601 date or date-time, or null" };
            }

            const [year, month, day] = value.slice(0, 10).split("-").map(Number);
            const calendarDate = new Date(0);
            calendarDate.setUTCFullYear(year, month - 1, day);
            const dueDate = new Date(value);
            if (
                Number.isNaN(dueDate.getTime()) ||
                calendarDate.getUTCFullYear() !== year ||
                calendarDate.getUTCMonth() !== month - 1 ||
                calendarDate.getUTCDate() !== day
            ) {
                return { error: "Due date must be a valid ISO 8601 date or date-time, or null" };
            }
            data.dueDate = dueDate;
        }
    }

    return { data };
}

function isValidTaskId(value) {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

module.exports = { isValidTaskId, validateTaskInput };
