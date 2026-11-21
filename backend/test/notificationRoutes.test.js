const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");
const {
    createNotificationService,
    NotificationServiceError
} = require("../src/services/notificationService");

const TEST_SECRET = "notification-routes-test-secret-with-at-least-32-bytes";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

process.env.JWT_SECRET = TEST_SECRET;

function tokenFor(userId = USER_A) {
    return jwt.sign({}, TEST_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        expiresIn: "1h",
        issuer: JWT_ISSUER,
        subject: userId
    });
}

function createMockService(overrides = {}) {
    return {
        listNotifications: async () => ({ notifications: [], pagination: {} }),
        getUnreadCount: async () => ({ unreadCount: 0 }),
        markNotificationRead: async () => ({ id: NOTIFICATION_ID, read: true }),
        markAllNotificationsRead: async () => ({ updatedCount: 0 }),
        deleteNotification: async () => undefined,
        ...overrides
    };
}

async function withServer(notificationService, run) {
    const server = createApp({ notificationService }).listen(0);
    await once(server, "listening");
    const address = server.address();
    const request = (path, options = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, options);

    try {
        await run(request);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

function authRequest(userId = USER_A) {
    return { headers: { authorization: `Bearer ${tokenFor(userId)}` } };
}

test("notification routes return list, unread count, read, read-all, and delete responses", async () => {
    const calls = [];
    const service = createMockService({
        listNotifications: async (...args) => {
            calls.push(["list", ...args]);
            return {
                notifications: [{ id: NOTIFICATION_ID, type: "task_due", read: false }],
                pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
            };
        },
        getUnreadCount: async (...args) => {
            calls.push(["unread", ...args]);
            return { unreadCount: 1 };
        },
        markNotificationRead: async (...args) => {
            calls.push(["read", ...args]);
            return { id: NOTIFICATION_ID, read: true };
        },
        markAllNotificationsRead: async (...args) => {
            calls.push(["readAll", ...args]);
            return { updatedCount: 1 };
        },
        deleteNotification: async (...args) => {
            calls.push(["delete", ...args]);
        }
    });

    await withServer(service, async (request) => {
        const listResponse = await request(
            "/api/notifications?type=task_due&unreadOnly=true&page=1&limit=10",
            authRequest()
        );
        assert.equal(listResponse.status, 200);
        assert.deepEqual(await listResponse.json(), {
            notifications: [{ id: NOTIFICATION_ID, type: "task_due", read: false }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
        });

        const countResponse = await request("/api/notifications/unread-count", authRequest());
        assert.deepEqual(await countResponse.json(), { unreadCount: 1 });

        const readResponse = await request(
            `/api/notifications/${NOTIFICATION_ID}/read`,
            { ...authRequest(), method: "PATCH" }
        );
        assert.deepEqual(await readResponse.json(), {
            notification: { id: NOTIFICATION_ID, read: true }
        });

        const readAllResponse = await request(
            "/api/notifications/read-all",
            { ...authRequest(), method: "PATCH" }
        );
        assert.deepEqual(await readAllResponse.json(), { updatedCount: 1 });

        const deleteResponse = await request(
            `/api/notifications/${NOTIFICATION_ID}`,
            { ...authRequest(), method: "DELETE" }
        );
        assert.equal(deleteResponse.status, 204);
        assert.equal(await deleteResponse.text(), "");
    });

    assert.deepEqual(calls, [
        ["list", USER_A, { type: "task_due", unreadOnly: true, page: 1, limit: 10 }],
        ["unread", USER_A],
        ["read", USER_A, NOTIFICATION_ID],
        ["readAll", USER_A],
        ["delete", USER_A, NOTIFICATION_ID]
    ]);
});

test("all notification endpoints require authentication and use the authenticated user ID", async () => {
    const calls = [];
    const service = createMockService({
        listNotifications: async (...args) => calls.push(args),
        getUnreadCount: async (...args) => calls.push(args),
        markNotificationRead: async (...args) => calls.push(args),
        markAllNotificationsRead: async (...args) => calls.push(args),
        deleteNotification: async (...args) => calls.push(args)
    });

    await withServer(service, async (request) => {
        const paths = [
            ["/api/notifications", "GET"],
            ["/api/notifications/unread-count", "GET"],
            ["/api/notifications/read-all", "PATCH"],
            [`/api/notifications/${NOTIFICATION_ID}/read`, "PATCH"],
            [`/api/notifications/${NOTIFICATION_ID}`, "DELETE"]
        ];
        for (const [path, method] of paths) {
            const response = await request(path, { method });
            assert.equal(response.status, 401);
            assert.deepEqual(await response.json(), { error: "Authentication required" });
        }

        const response = await request("/api/notifications/unread-count", authRequest(USER_B));
        assert.equal(response.status, 200);
    });
    assert.deepEqual(calls, [[USER_B]]);
});

test("unread counts are user-scoped and decrease when a notification is read", async () => {
    const notifications = [];
    let nextId = 0;
    const matchesWhere = (notification, where) => Object.entries(where)
        .every(([key, value]) => notification[key] === value);
    const prismaClient = {
        notification: {
            create: async ({ data }) => {
                const notification = {
                    ...data,
                    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${nextId++}`,
                    readAt: null,
                    createdAt: new Date("2026-01-01T00:00:00.000Z")
                };
                notifications.push(notification);
                return notification;
            },
            count: async ({ where }) => notifications
                .filter((notification) => matchesWhere(notification, where)).length,
            updateMany: async ({ where, data }) => {
                const matching = notifications.filter((notification) =>
                    matchesWhere(notification, where)
                );
                matching.forEach((notification) => Object.assign(notification, data));
                return { count: matching.length };
            },
            findFirst: async ({ where }) => notifications.find((notification) =>
                matchesWhere(notification, where)
            ) || null
        },
        $transaction: async (callback) => callback(prismaClient)
    };
    const notificationService = createNotificationService({
        prismaClient,
        clock: () => new Date("2026-01-02T00:00:00.000Z")
    });

    await notificationService.createNotification({
        userId: USER_A,
        type: "system",
        title: "Test notification",
        message: "Unread for user A"
    });

    await withServer(notificationService, async (request) => {
        const userBCount = await request("/api/notifications/unread-count", authRequest(USER_B));
        assert.deepEqual(await userBCount.json(), { unreadCount: 0 });

        const userACount = await request("/api/notifications/unread-count", authRequest(USER_A));
        assert.deepEqual(await userACount.json(), { unreadCount: 1 });

        const readResponse = await request(
            `/api/notifications/${notifications[0].id}/read`,
            { ...authRequest(USER_A), method: "PATCH" }
        );
        assert.equal(readResponse.status, 200);
        assert.deepEqual((await readResponse.json()).notification, {
            id: notifications[0].id,
            userId: USER_A,
            type: "system",
            title: "Test notification",
            message: "Unread for user A",
            read: true,
            actionUrl: null,
            createdAt: "2026-01-01T00:00:00.000Z"
        });

        const updatedUserACount = await request("/api/notifications/unread-count", authRequest(USER_A));
        assert.deepEqual(await updatedUserACount.json(), { unreadCount: 0 });
        const unchangedUserBCount = await request("/api/notifications/unread-count", authRequest(USER_B));
        assert.deepEqual(await unchangedUserBCount.json(), { unreadCount: 0 });
    });
});

test("invalid notification IDs and query values return 400 without service calls", async () => {
    let serviceCalls = 0;
    const service = createMockService({
        listNotifications: async () => {
            serviceCalls += 1;
            return {};
        },
        markNotificationRead: async () => {
            serviceCalls += 1;
        },
        deleteNotification: async () => {
            serviceCalls += 1;
        }
    });

    await withServer(service, async (request) => {
        for (const path of [
            "/api/notifications?page=0",
            "/api/notifications?unknown=true",
            "/api/notifications?unreadOnly=yes",
            "/api/notifications?type=deadline",
            "/api/notifications/not-a-uuid/read",
            "/api/notifications/not-a-uuid"
        ]) {
            const method = path.includes("/read") ? "PATCH" : (
                path.startsWith("/api/notifications/not-a-uuid") ? "DELETE" : "GET"
            );
            const response = await request(path, { ...authRequest(), method });
            assert.equal(response.status, 400);
            assert.equal(typeof (await response.json()).error, "string");
        }
    });
    assert.equal(serviceCalls, 0);
});

test("service not-found and unexpected errors map to safe HTTP responses", async () => {
    const missingService = createMockService({
        markNotificationRead: async () => {
            throw new NotificationServiceError("Notification not found", "NOT_FOUND", 404);
        },
        deleteNotification: async () => {
            throw new NotificationServiceError("Notification not found", "NOT_FOUND", 404);
        }
    });

    await withServer(missingService, async (request) => {
        const readResponse = await request(
            `/api/notifications/${NOTIFICATION_ID}/read`,
            { ...authRequest(), method: "PATCH" }
        );
        assert.equal(readResponse.status, 404);
        assert.deepEqual(await readResponse.json(), { error: "Notification not found" });

        const deleteResponse = await request(
            `/api/notifications/${NOTIFICATION_ID}`,
            { ...authRequest(), method: "DELETE" }
        );
        assert.equal(deleteResponse.status, 404);
    });

    const failingService = createMockService({
        getUnreadCount: async () => {
            throw new Error("database URL or query details must not leak");
        }
    });
    await withServer(failingService, async (request) => {
        const response = await request("/api/notifications/unread-count", authRequest());
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: "Internal server error" });
    });
});

test("notification creation is not exposed as a public endpoint", async () => {
    let calls = 0;
    const service = createMockService({
        createNotification: async () => {
            calls += 1;
        }
    });
    await withServer(service, async (request) => {
        const response = await request("/api/notifications", {
            ...authRequest(),
            method: "POST",
            headers: { ...authRequest().headers, "content-type": "application/json" },
            body: JSON.stringify({
                type: "system",
                title: "Hello",
                message: "Client creation should not work"
            })
        });
        assert.equal(response.status, 404);
    });
    assert.equal(calls, 0);
});
