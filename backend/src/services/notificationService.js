const prisma = require("../lib/prisma");
const {
    NOTIFICATION_TYPES,
    MAX_PAGE,
    MAX_LIMIT,
    isValidNotificationId
} = require("../validators/notificationValidators");

const TYPE_TO_PRISMA = {
    task_due: "TASK_DUE",
    task_completed: "TASK_COMPLETED",
    study_reminder: "STUDY_REMINDER",
    study_plan_updated: "STUDY_PLAN_UPDATED",
    system: "SYSTEM"
};
const TYPE_FROM_PRISMA = Object.fromEntries(
    Object.entries(TYPE_TO_PRISMA).map(([apiType, prismaType]) => [prismaType, apiType])
);
const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_ACTION_URL_LENGTH = 2048;
const MAX_DEDUPE_KEY_LENGTH = 255;

class NotificationServiceError extends Error {
    constructor(message, code, status) {
        super(message);
        this.name = "NotificationServiceError";
        this.code = code;
        this.status = status;
    }
}

function invalidInput(message) {
    return new NotificationServiceError(message, "INVALID_INPUT", 400);
}

function notFound() {
    return new NotificationServiceError("Notification not found", "NOT_FOUND", 404);
}

function validateCreateInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw invalidInput("A notification input object is required");
    }

    const allowedFields = new Set([
        "userId",
        "type",
        "title",
        "message",
        "actionUrl",
        "dedupeKey",
        "taskId",
        "studyPlanId",
        "scheduleItemId"
    ]);
    const unsupportedField = Object.keys(input).find((field) => !allowedFields.has(field));
    if (unsupportedField) {
        throw invalidInput(`Unsupported notification field: ${unsupportedField}`);
    }
    if (!isValidNotificationId(input.userId)) {
        throw invalidInput("Notification user ID must be a valid UUID");
    }
    if (!Object.hasOwn(TYPE_TO_PRISMA, input.type)) {
        throw invalidInput("Notification type is invalid");
    }
    if (
        typeof input.title !== "string" ||
        !input.title.trim() ||
        input.title.trim().length > MAX_TITLE_LENGTH
    ) {
        throw invalidInput(`Notification title must be 1-${MAX_TITLE_LENGTH} characters`);
    }
    if (
        typeof input.message !== "string" ||
        !input.message.trim() ||
        input.message.trim().length > MAX_MESSAGE_LENGTH
    ) {
        throw invalidInput(`Notification message must be 1-${MAX_MESSAGE_LENGTH} characters`);
    }

    let actionUrl = null;
    if (input.actionUrl !== undefined && input.actionUrl !== null) {
        if (
            typeof input.actionUrl !== "string" ||
            input.actionUrl.length > MAX_ACTION_URL_LENGTH ||
            !input.actionUrl.startsWith("/") ||
            input.actionUrl.startsWith("//")
        ) {
            throw invalidInput("Notification action URL must be a local application path");
        }
        actionUrl = input.actionUrl;
    }

    let dedupeKey = null;
    if (input.dedupeKey !== undefined && input.dedupeKey !== null) {
        if (
            typeof input.dedupeKey !== "string" ||
            !input.dedupeKey.trim() ||
            input.dedupeKey.length > MAX_DEDUPE_KEY_LENGTH
        ) {
            throw invalidInput(`Notification dedupe key must be 1-${MAX_DEDUPE_KEY_LENGTH} characters`);
        }
        dedupeKey = input.dedupeKey;
    }

    const relatedIds = ["taskId", "studyPlanId", "scheduleItemId"];
    for (const field of relatedIds) {
        if (input[field] !== undefined && input[field] !== null && !isValidNotificationId(input[field])) {
            throw invalidInput(`${field} must be a valid UUID`);
        }
    }

    const requiredRelation = {
        task_due: "taskId",
        task_completed: "taskId",
        study_reminder: "scheduleItemId",
        study_plan_updated: "studyPlanId"
    }[input.type];
    if (requiredRelation && !input[requiredRelation]) {
        throw invalidInput(`${input.type} notification requires ${requiredRelation}`);
    }

    return {
        userId: input.userId,
        type: TYPE_TO_PRISMA[input.type],
        title: input.title.trim(),
        message: input.message.trim(),
        actionUrl,
        dedupeKey,
        taskId: input.taskId || null,
        studyPlanId: input.studyPlanId || null,
        scheduleItemId: input.scheduleItemId || null
    };
}

function toApiNotification(notification) {
    return {
        id: notification.id,
        userId: notification.userId,
        type: TYPE_FROM_PRISMA[notification.type],
        title: notification.title,
        message: notification.message,
        read: notification.readAt !== null,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt
    };
}

function createNotificationService({ prismaClient = prisma, clock = () => new Date() } = {}) {
    async function assertRelatedResourceOwnership(client, data) {
        if (data.taskId) {
            const task = await client.task.findFirst({
                where: { id: data.taskId, userId: data.userId },
                select: { id: true }
            });
            if (!task) {
                throw invalidInput("Notification task must belong to its user");
            }
        }

        if (data.studyPlanId) {
            const plan = await client.studyPlan.findFirst({
                where: { id: data.studyPlanId, userId: data.userId },
                select: { id: true }
            });
            if (!plan) {
                throw invalidInput("Notification study plan must belong to its user");
            }
        }

        if (data.scheduleItemId) {
            const scheduleItem = await client.scheduleItem.findFirst({
                where: {
                    id: data.scheduleItemId,
                    subject: { is: { plan: { is: { userId: data.userId } } } }
                },
                select: { id: true }
            });
            if (!scheduleItem) {
                throw invalidInput("Notification schedule item must belong to its user");
            }
        }
    }

    async function createNotification(input, transactionClient) {
        const data = validateCreateInput(input);

        const createWithClient = async (client) => {
            await assertRelatedResourceOwnership(client, data);
            if (data.dedupeKey) {
                const result = await client.notification.createMany({
                    data: [data],
                    skipDuplicates: true
                });
                return result.count;
            }

            const notification = await client.notification.create({ data });
            return toApiNotification(notification);
        };

        return transactionClient
            ? createWithClient(transactionClient)
            : prismaClient.$transaction(createWithClient);
    }

    async function listNotifications(userId, { type, unreadOnly, page, limit }) {
        if (!isValidNotificationId(userId)) {
            throw invalidInput("Authenticated user ID must be a valid UUID");
        }
        if (
            !Number.isSafeInteger(page) ||
            page < 1 ||
            page > MAX_PAGE ||
            !Number.isSafeInteger(limit) ||
            limit < 1 ||
            limit > MAX_LIMIT
        ) {
            throw invalidInput("Notification pagination is outside the supported range");
        }

        const where = {
            userId,
            ...(type ? { type: TYPE_TO_PRISMA[type] } : {}),
            ...(unreadOnly ? { readAt: null } : {})
        };
        const skip = (page - 1) * limit;
        const [notifications, total] = await Promise.all([
            prismaClient.notification.findMany({
                where,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip,
                take: limit
            }),
            prismaClient.notification.count({ where })
        ]);

        return {
            notifications: notifications.map(toApiNotification),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async function getUnreadCount(userId) {
        if (!isValidNotificationId(userId)) {
            throw invalidInput("Authenticated user ID must be a valid UUID");
        }
        const unreadCount = await prismaClient.notification.count({
            where: { userId, readAt: null }
        });
        return { unreadCount };
    }

    async function markNotificationRead(userId, notificationId) {
        if (!isValidNotificationId(userId) || !isValidNotificationId(notificationId)) {
            throw invalidInput("User and notification IDs must be valid UUIDs");
        }

        await prismaClient.notification.updateMany({
            where: { id: notificationId, userId, readAt: null },
            data: { readAt: clock() }
        });
        const notification = await prismaClient.notification.findFirst({
            where: { id: notificationId, userId }
        });
        if (!notification) {
            throw notFound();
        }
        return toApiNotification(notification);
    }

    async function markAllNotificationsRead(userId) {
        if (!isValidNotificationId(userId)) {
            throw invalidInput("Authenticated user ID must be a valid UUID");
        }
        const result = await prismaClient.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: clock() }
        });
        return { updatedCount: result.count };
    }

    async function deleteNotification(userId, notificationId) {
        if (!isValidNotificationId(userId) || !isValidNotificationId(notificationId)) {
            throw invalidInput("User and notification IDs must be valid UUIDs");
        }
        const result = await prismaClient.notification.deleteMany({
            where: { id: notificationId, userId }
        });
        if (result.count === 0) {
            throw notFound();
        }
    }

    return {
        createNotification,
        listNotifications,
        getUnreadCount,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification
    };
}

const notificationService = createNotificationService();

module.exports = {
    NotificationServiceError,
    createNotificationService,
    ...notificationService
};
