const TASK_STATUSES = new Set(["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"]);
const TASK_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const TASK_FIELDS = new Set([
    "title",
    "description",
    "category",
    "tags",
    "subtasks",
    "status",
    "priority",
    "dueDate"
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;
const MAX_TASK_TITLE_LENGTH = 120;
const MAX_TASK_DESCRIPTION_LENGTH = 1000;
const MAX_TASK_CATEGORY_LENGTH = 64;
const MAX_TASK_TAGS = 20;
const MAX_SUBTASKS = 100;

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
        } else if (field === "category") {
            if (
                typeof value !== "string" ||
                !value.trim() ||
                value.trim().length > MAX_TASK_CATEGORY_LENGTH
            ) {
                return { error: `Category must be 1-${MAX_TASK_CATEGORY_LENGTH} characters` };
            }
            data.category = value.trim();
        } else if (field === "tags") {
            if (
                !Array.isArray(value) ||
                value.length > MAX_TASK_TAGS ||
                value.some((tag) =>
                    typeof tag !== "string" || !tag.trim() || tag.trim().length > 64
                )
            ) {
                return { error: `Tags must be an array of at most ${MAX_TASK_TAGS} non-empty strings` };
            }
            data.tags = value.map((tag) => tag.trim());
        } else if (field === "subtasks") {
            if (!Array.isArray(value) || value.length > MAX_SUBTASKS) {
                return { error: `Subtasks must be an array of at most ${MAX_SUBTASKS} items` };
            }
            const subtasks = [];
            for (const subtask of value) {
                if (
                    !subtask ||
                    typeof subtask !== "object" ||
                    Array.isArray(subtask) ||
                    Object.keys(subtask).some((key) => !["id", "title", "completed"].includes(key)) ||
                    typeof subtask.id !== "string" ||
                    !subtask.id.trim() ||
                    subtask.id.length > 128 ||
                    typeof subtask.title !== "string" ||
                    !subtask.title.trim() ||
                    subtask.title.trim().length > 120 ||
                    typeof subtask.completed !== "boolean"
                ) {
                    return { error: "Each subtask must have a valid id, title, and completed value" };
                }
                subtasks.push({
                    id: subtask.id,
                    title: subtask.title.trim(),
                    completed: subtask.completed
                });
            }
            data.subtasks = subtasks;
        } else if (field === "status") {
            if (!TASK_STATUSES.has(value)) {
                return { error: "Status must be TODO, IN_PROGRESS, IN_REVIEW, or COMPLETED" };
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
