const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createNotificationService,
    NotificationServiceError
} = require("../src/services/notificationService");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createPrismaMock(overrides = {}) {
    const { notification = {}, ...prismaOverrides } = overrides;
    const client = {
        ...prismaOverrides,
        task: {
            findFirst: async () => ({ id: TASK_ID }),
            ...(overrides.task || {})
        },
        studyPlan: {
            findFirst: async () => ({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
            ...(overrides.studyPlan || {})
        },
        scheduleItem: {
            findFirst: async () => ({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }),
            ...(overrides.scheduleItem || {})
        },
        notification: {
            create: async () => ({ id: NOTIFICATION_ID }),
            createMany: async () => ({ count: 1 }),
            findMany: async () => [],
            count: async () => 0,
            updateMany: async () => ({ count: 1 }),
            findFirst: async () => null,
            deleteMany: async () => ({ count: 1 }),
            ...notification
        }
    };
    client.$transaction = async (callback) => callback(client);
    return client;
}

function assertServiceError(promise, code, status) {
    return assert.rejects(promise, (error) => {
        assert.ok(error instanceof NotificationServiceError);
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        return true;
    });
}

test("lists only the caller's notifications with stable pagination and API type mapping", async () => {
    const calls = [];
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            notification: {
                findMany: async (args) => {
                    calls.push(["findMany", args]);
                    return [{
                        id: NOTIFICATION_ID,
                        userId: USER_ID,
                        type: "TASK_DUE",
                        title: "Due soon",
                        message: "Review your task.",
                        readAt: null,
                        actionUrl: `/tasks/${TASK_ID}`,
                        createdAt: new Date("2026-11-16T12:00:00.000Z")
                    }];
                },
                count: async (args) => {
                    calls.push(["count", args]);
                    return 21;
                }
            }
        })
    });

    const result = await service.listNotifications(USER_ID, {
        type: "task_due",
        unreadOnly: true,
        page: 2,
        limit: 10
    });

    assert.deepEqual(calls[0][1], {
        where: { userId: USER_ID, type: "TASK_DUE", readAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 10,
        take: 10
    });
    assert.deepEqual(calls[1][1], { where: { userId: USER_ID, type: "TASK_DUE", readAt: null } });
    assert.deepEqual(result, {
        notifications: [{
            id: NOTIFICATION_ID,
            userId: USER_ID,
            type: "task_due",
            title: "Due soon",
            message: "Review your task.",
            read: false,
            actionUrl: `/tasks/${TASK_ID}`,
            createdAt: new Date("2026-11-16T12:00:00.000Z")
        }],
        pagination: { page: 2, limit: 10, total: 21, totalPages: 3 }
    });
});

test("counts unread notifications and marks one read idempotently for its owner", async () => {
    const calls = [];
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            notification: {
                count: async (args) => {
                    calls.push(["count", args]);
                    return 3;
                },
                updateMany: async (args) => {
                    calls.push(["updateMany", args]);
                    return { count: 0 };
                },
                findFirst: async (args) => {
                    calls.push(["findFirst", args]);
                    return {
                        id: NOTIFICATION_ID,
                        userId: USER_ID,
                        type: "SYSTEM",
                        title: "Update",
                        message: "System update.",
                        readAt: new Date("2026-11-16T12:00:00.000Z"),
                        actionUrl: null,
                        createdAt: new Date("2026-11-16T11:00:00.000Z")
                    };
                }
            }
        }),
        clock: () => new Date("2026-11-16T12:00:00.000Z")
    });

    assert.deepEqual(await service.getUnreadCount(USER_ID), { unreadCount: 3 });
    const notification = await service.markNotificationRead(USER_ID, NOTIFICATION_ID);

    assert.deepEqual(calls[0][1], { where: { userId: USER_ID, readAt: null } });
    assert.deepEqual(calls[1][1], {
        where: { id: NOTIFICATION_ID, userId: USER_ID, readAt: null },
        data: { readAt: new Date("2026-11-16T12:00:00.000Z") }
    });
    assert.deepEqual(calls[2][1], { where: { id: NOTIFICATION_ID, userId: USER_ID } });
    assert.equal(notification.read, true);
});

test("marks all owned unread notifications and deletes only an owned notification", async () => {
    const calls = [];
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            notification: {
                updateMany: async (args) => {
                    calls.push(["updateMany", args]);
                    return { count: 2 };
                },
                deleteMany: async (args) => {
                    calls.push(["deleteMany", args]);
                    return { count: 1 };
                }
            }
        })
    });

    assert.deepEqual(await service.markAllNotificationsRead(USER_ID), { updatedCount: 2 });
    await service.deleteNotification(USER_ID, NOTIFICATION_ID);
    assert.deepEqual(calls[0][1].where, { userId: USER_ID, readAt: null });
    assert.deepEqual(calls[1][1].where, { id: NOTIFICATION_ID, userId: USER_ID });
});

test("reports missing and cross-user notifications as not found", async () => {
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            notification: {
                findFirst: async () => null,
                deleteMany: async () => ({ count: 0 })
            }
        })
    });

    await assertServiceError(
        service.markNotificationRead(USER_ID, NOTIFICATION_ID),
        "NOT_FOUND",
        404
    );
    await assertServiceError(
        service.deleteNotification(USER_ID, NOTIFICATION_ID),
        "NOT_FOUND",
        404
    );
});

test("notification service rejects invalid pagination before issuing Prisma queries", async () => {
    let queries = 0;
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            notification: {
                findMany: async () => {
                    queries += 1;
                    return [];
                },
                count: async () => {
                    queries += 1;
                    return 0;
                }
            }
        })
    });

    for (const pagination of [
        { page: 0, limit: 20 },
        { page: 1001, limit: 20 },
        { page: 1.5, limit: 20 },
        { page: 1, limit: 101 },
        { page: 1, limit: Number.MAX_SAFE_INTEGER + 1 }
    ]) {
        await assertServiceError(
            service.listNotifications(USER_ID, pagination),
            "INVALID_INPUT",
            400
        );
    }

    assert.equal(queries, 0);
});

test("creates trusted internal notifications and safely ignores duplicate keys", async () => {
    const calls = [];
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            notification: {
                createMany: async (args) => {
                    calls.push(args);
                    return { count: 0 };
                }
            }
        })
    });

    const result = await service.createNotification({
        userId: USER_ID,
        type: "task_due",
        title: "  Due soon ",
        message: " Review the task. ",
        actionUrl: `/tasks/${TASK_ID}`,
        taskId: TASK_ID,
        dedupeKey: `task_due:${TASK_ID}:2026-11-16`
    });

    assert.equal(result, 0);
    assert.deepEqual(calls[0], {
        data: [{
            userId: USER_ID,
            type: "TASK_DUE",
            title: "Due soon",
            message: "Review the task.",
            actionUrl: `/tasks/${TASK_ID}`,
            dedupeKey: `task_due:${TASK_ID}:2026-11-16`,
            taskId: TASK_ID,
            studyPlanId: null,
            scheduleItemId: null
        }],
        skipDuplicates: true
    });
});

test("creates a SYSTEM notification for its specified user and exposes the public type", async () => {
    let createArgs;
    const createdAt = new Date("2026-11-16T12:00:00.000Z");
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            notification: {
                create: async (args) => {
                    createArgs = args;
                    return {
                        id: NOTIFICATION_ID,
                        ...args.data,
                        readAt: null,
                        createdAt
                    };
                }
            }
        })
    });

    const notification = await service.createNotification({
        userId: OTHER_USER_ID,
        type: "system",
        title: "Maintenance notice",
        message: "A scheduled maintenance window is coming up.",
        actionUrl: "/settings"
    });

    assert.deepEqual(createArgs.data, {
        userId: OTHER_USER_ID,
        type: "SYSTEM",
        title: "Maintenance notice",
        message: "A scheduled maintenance window is coming up.",
        actionUrl: "/settings",
        dedupeKey: null,
        taskId: null,
        studyPlanId: null,
        scheduleItemId: null
    });
    assert.equal(notification.userId, OTHER_USER_ID);
    assert.equal(notification.type, "system");
    assert.equal(notification.read, false);
    assert.equal(notification.createdAt, createdAt);
});

test("rejects untrusted, malformed, and inconsistent internal notification input", async () => {
    const service = createNotificationService({ prismaClient: createPrismaMock() });
    const base = {
        userId: USER_ID,
        type: "task_due",
        title: "Due soon",
        message: "Review the task.",
        taskId: TASK_ID
    };

    for (const input of [
        { ...base, userId: "not-a-uuid" },
        { ...base, type: "deadline" },
        { ...base, title: " " },
        { ...base, title: "x".repeat(121) },
        { ...base, actionUrl: "https://example.com" },
        { ...base, userId: USER_ID, clientSupplied: true },
        { ...base, taskId: undefined }
    ]) {
        await assertServiceError(
            service.createNotification(input),
            "INVALID_INPUT",
            400
        );
    }
});

test("rejects notifications that reference another user's task, plan, or schedule item", async () => {
    const writes = [];
    const service = createNotificationService({
        prismaClient: createPrismaMock({
            task: { findFirst: async () => null },
            studyPlan: { findFirst: async () => null },
            scheduleItem: { findFirst: async () => null },
            notification: {
                create: async (...args) => {
                    writes.push(args);
                    return { id: NOTIFICATION_ID };
                },
                createMany: async (...args) => {
                    writes.push(args);
                    return { count: 1 };
                }
            }
        })
    });

    await assertServiceError(service.createNotification({
        userId: USER_ID,
        type: "task_due",
        title: "Due soon",
        message: "Review the task.",
        taskId: TASK_ID
    }), "INVALID_INPUT", 400);
    await assertServiceError(service.createNotification({
        userId: USER_ID,
        type: "study_plan_updated",
        title: "Plan updated",
        message: "Review the plan.",
        studyPlanId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    }), "INVALID_INPUT", 400);
    await assertServiceError(service.createNotification({
        userId: USER_ID,
        type: "study_reminder",
        title: "Study soon",
        message: "Your session starts soon.",
        scheduleItemId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    }), "INVALID_INPUT", 400);

    assert.deepEqual(writes, []);
});
