const NOTIFICATION_TYPES = new Set([
    "task_due",
    "task_completed",
    "study_reminder",
    "study_plan_updated",
    "system"
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_QUERY_FIELDS = new Set(["type", "unreadOnly", "page", "limit"]);
const MAX_PAGE = 1000;
const MAX_LIMIT = 100;
const MAX_ALLOWED_SKIP = (MAX_PAGE - 1) * MAX_LIMIT;

function isValidNotificationId(value) {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

function parsePositiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
    if (typeof value !== "string" && typeof value !== "number") {
        return { error: `${name} must be a positive integer` };
    }

    const normalized = typeof value === "string" ? value.trim() : String(value);
    if (!/^[1-9]\d*$/.test(normalized)) {
        return { error: `${name} must be a positive integer` };
    }

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed > maximum) {
        return { error: `${name} is outside the supported range` };
    }
    return { value: parsed };
}

function validateNotificationListQuery(query) {
    if (!query || typeof query !== "object" || Array.isArray(query)) {
        return { error: "Notification query parameters are invalid" };
    }

    const unsupportedField = Object.keys(query).find((field) => !LIST_QUERY_FIELDS.has(field));
    if (unsupportedField) {
        return { error: `Unsupported notification query parameter: ${unsupportedField}` };
    }

    let type;
    if (Object.hasOwn(query, "type")) {
        if (typeof query.type !== "string" || !NOTIFICATION_TYPES.has(query.type)) {
            return { error: "Notification type is invalid" };
        }
        type = query.type;
    }

    let unreadOnly = false;
    if (Object.hasOwn(query, "unreadOnly")) {
        if (query.unreadOnly === true || query.unreadOnly === false) {
            unreadOnly = query.unreadOnly;
        } else if (query.unreadOnly !== "true" && query.unreadOnly !== "false") {
            return { error: "unreadOnly must be true or false" };
        } else {
            unreadOnly = query.unreadOnly === "true";
        }
    }

    const pageResult = Object.hasOwn(query, "page")
        ? parsePositiveInteger(query.page, "page", MAX_PAGE)
        : { value: 1 };
    if (pageResult.error) {
        return pageResult;
    }

    const limitResult = Object.hasOwn(query, "limit")
        ? parsePositiveInteger(query.limit, "limit", MAX_LIMIT)
        : { value: 20 };
    if (limitResult.error) {
        return limitResult;
    }

    const skip = (pageResult.value - 1) * limitResult.value;
    if (!Number.isSafeInteger(skip) || skip > MAX_ALLOWED_SKIP) {
        return { error: "page and limit exceed the supported range" };
    }

    return {
        data: {
            type,
            unreadOnly,
            page: pageResult.value,
            limit: limitResult.value
        }
    };
}

module.exports = {
    NOTIFICATION_TYPES,
    MAX_PAGE,
    MAX_LIMIT,
    isValidNotificationId,
    validateNotificationListQuery
};
