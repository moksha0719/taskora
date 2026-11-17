const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");

const TEST_SECRET = "task-api-test-secret-with-at-least-32-bytes";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const TASK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK_SELECT = {
    id: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    dueDate: true,
    createdAt: true,
    updatedAt: true
};

process.env.JWT_SECRET = TEST_SECRET;

function selected(task, select) {
    return Object.fromEntries(Object.keys(select).map((field) => [field, task[field]]));
}

function notFoundError() {
    const error = new Error("Record not found");
    error.code = "P2025";
    return error;
}

function createPrismaMock(seed = []) {
    const tasks = new Map(seed.map((task) => [task.id, { ...task }]));

    const prisma = {
        tasks,
        task: {
            create: async ({ data, select }) => {
                const now = new Date();
                const task = {
                    id: randomUUID(),
                    description: null,
                    status: "TODO",
                    priority: "MEDIUM",
                    dueDate: null,
                    createdAt: now,
                    updatedAt: now,
                    ...data
                };
                tasks.set(task.id, task);
                return selected(task, select);
            },
            findMany: async ({ where, select }) => [...tasks.values()]
                .filter((task) => task.userId === where.userId)
                .sort((left, right) => right.createdAt - left.createdAt)
                .map((task) => selected(task, select)),
            findFirst: async ({ where, select }) => {
                const task = tasks.get(where.id);
                return task && task.userId === where.userId ? selected(task, select) : null;
            },
            updateMany: async ({ where, data }) => {
                const task = tasks.get(where.id);
                if (
                    !task ||
                    task.userId !== where.userId ||
                    (where.status && task.status === where.status.not)
                ) {
                    return { count: 0 };
                }
                Object.assign(task, data, { updatedAt: new Date() });
                return { count: 1 };
            },
            update: async ({ where, data, select }) => {
                const task = tasks.get(where.id);
                if (!task || task.userId !== where.userId) {
                    throw notFoundError();
                }
                Object.assign(task, data, { updatedAt: new Date() });
                return selected(task, select);
            },
            delete: async ({ where }) => {
                const task = tasks.get(where.id);
                if (!task || task.userId !== where.userId) {
                    throw notFoundError();
                }
                tasks.delete(where.id);
                return task;
            }
        }
    };
    prisma.$transaction = async (callback) => callback({ task: prisma.task });
    return prisma;
}

function tokenFor(userId) {
    return jwt.sign({}, TEST_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        expiresIn: "1h",
        issuer: JWT_ISSUER,
        subject: userId
    });
}

async function withServer(
    prisma,
    run,
    notificationService = { createNotification: async () => ({}) }
) {
    const server = createApp({ prismaClient: prisma, notificationService }).listen(0);
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

function jsonRequest(method, body, userId = USER_A) {
    return {
        method,
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tokenFor(userId)}`
        },
        body: JSON.stringify(body)
    };
}

function seedTask(id, userId, title = "Existing task") {
    return {
        id,
        userId,
        title,
        description: null,
        status: "TODO",
        priority: "MEDIUM",
        dueDate: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
    };
}

test("authenticated user can create a task with validated fields", async () => {
    const prisma = createPrismaMock();

    await withServer(prisma, async (request) => {
        const response = await request("/api/tasks", jsonRequest("POST", {
            title: "  Prepare release ",
            description: "Check production readiness",
            status: "IN_PROGRESS",
            priority: "HIGH",
            dueDate: "2026-12-01T12:30:00Z"
        }));
        const body = await response.json();
        const stored = [...prisma.tasks.values()][0];

        assert.equal(response.status, 201);
        assert.equal(body.task.title, "Prepare release");
        assert.equal(body.task.status, "IN_PROGRESS");
        assert.equal(body.task.priority, "HIGH");
        assert.equal(body.task.dueDate, "2026-12-01T12:30:00.000Z");
        assert.deepEqual(Object.keys(body.task).sort(), [
            "createdAt",
            "description",
            "dueDate",
            "id",
            "priority",
            "status",
            "title",
            "updatedAt"
        ]);
        assert.equal(stored.userId, USER_A);
        assert.equal("userId" in body.task, false);
    });
});

test("list and read only return tasks owned by the authenticated user", async () => {
    const prisma = createPrismaMock([
        seedTask(TASK_A, USER_A, "My task"),
        seedTask(TASK_B, USER_B, "Other user's task")
    ]);

    await withServer(prisma, async (request) => {
        const list = await request("/api/tasks", { headers: { authorization: `Bearer ${tokenFor(USER_A)}` } });
        const listBody = await list.json();
        assert.equal(list.status, 200);
        assert.deepEqual(listBody.tasks.map((task) => task.id), [TASK_A]);

        const ownTask = await request(`/api/tasks/${TASK_A}`, { headers: { authorization: `Bearer ${tokenFor(USER_A)}` } });
        assert.equal(ownTask.status, 200);
        assert.equal((await ownTask.json()).task.title, "My task");

        const otherTask = await request(`/api/tasks/${TASK_B}`, { headers: { authorization: `Bearer ${tokenFor(USER_A)}` } });
        assert.equal(otherTask.status, 404);
        assert.deepEqual(await otherTask.json(), { error: "Task not found" });
    });
});

test("user can update an owned task but cannot update another user's task", async () => {
    const prisma = createPrismaMock([
        seedTask(TASK_A, USER_A),
        seedTask(TASK_B, USER_B, "Do not change")
    ]);

    await withServer(prisma, async (request) => {
        const ownUpdate = await request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", {
            title: "Updated task",
            status: "COMPLETED"
        }));
        assert.equal(ownUpdate.status, 200);
        const updated = (await ownUpdate.json()).task;
        assert.equal(updated.title, "Updated task");
        assert.equal(updated.status, "COMPLETED");

        const otherUpdate = await request(`/api/tasks/${TASK_B}`, jsonRequest("PUT", {
            title: "Unauthorized change"
        }));
        assert.equal(otherUpdate.status, 404);
        assert.equal(prisma.tasks.get(TASK_B).title, "Do not change");
    });

});

test("task completion creates one owner-scoped notification transactionally", async () => {
    const prisma = createPrismaMock([seedTask(TASK_A, USER_A)]);
    const notificationCalls = [];
    const notificationService = {
        createNotification: async (...args) => {
            notificationCalls.push(args);
            return {};
        }
    };

    await withServer(prisma, async (request) => {
        const firstResponse = await request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", {
            status: "COMPLETED"
        }));
        assert.equal(firstResponse.status, 200);

        const repeatedResponse = await request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", {
            title: "Completed task",
            status: "COMPLETED"
        }));
        assert.equal(repeatedResponse.status, 200);
    }, notificationService);

    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0][0].userId, USER_A);
    assert.equal(notificationCalls[0][0].type, "task_completed");
    assert.equal(notificationCalls[0][0].taskId, TASK_A);
    assert.equal(notificationCalls[0][0].actionUrl, `/tasks/${TASK_A}`);
});

test("concurrent task completion requests create only one notification", async () => {
    const prisma = createPrismaMock([seedTask(TASK_A, USER_A)]);
    const notificationCalls = [];
    const notificationService = {
        createNotification: async (...args) => {
            notificationCalls.push(args);
            await new Promise((resolve) => setTimeout(resolve, 5));
            return {};
        }
    };

    await withServer(prisma, async (request) => {
        const responses = await Promise.all([
            request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", { status: "COMPLETED" })),
            request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", { status: "COMPLETED" }))
        ]);
        assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    }, notificationService);

    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0][0].taskId, TASK_A);
    assert.equal(notificationCalls[0][0].userId, USER_A);
    assert.equal(prisma.tasks.get(TASK_A).status, "COMPLETED");
});

test("user can delete an owned task but cannot delete another user's task", async () => {
    const prisma = createPrismaMock([
        seedTask(TASK_A, USER_A),
        seedTask(TASK_B, USER_B)
    ]);

    await withServer(prisma, async (request) => {
        const ownDelete = await request(`/api/tasks/${TASK_A}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${tokenFor(USER_A)}` }
        });
        assert.equal(ownDelete.status, 204);
        assert.equal(prisma.tasks.has(TASK_A), false);

        const otherDelete = await request(`/api/tasks/${TASK_B}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${tokenFor(USER_A)}` }
        });
        assert.equal(otherDelete.status, 404);
        assert.equal(prisma.tasks.has(TASK_B), true);
    });
});

test("task creation and updates reject invalid fields and values", async () => {
    await withServer(createPrismaMock(), async (request) => {
        const invalidBodies = [
            { description: "Title is required" },
            { title: "   " },
            { title: "Task", status: "DONE" },
            { title: "Task", priority: "URGENT" },
            { title: "Task", description: 12 },
            { title: "Task", dueDate: "not-a-date" },
            { title: "Task", dueDate: "2026-02-31T12:00:00Z" },
            { title: "Task", userId: USER_B },
            { title: "Task", ownerId: USER_B }
        ];

        for (const body of invalidBodies) {
            const response = await request("/api/tasks", jsonRequest("POST", body));
            assert.equal(response.status, 400);
        }

        const emptyUpdate = await request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", {}));
        assert.equal(emptyUpdate.status, 400);
        const invalidUpdate = await request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", { status: "DONE" }));
        assert.equal(invalidUpdate.status, 400);
        const unsupportedUpdate = await request(
            `/api/tasks/${TASK_A}`,
            jsonRequest("PUT", { title: "Task", userId: USER_B })
        );
        assert.equal(unsupportedUpdate.status, 400);
    });
});

test("task text fields accept configured boundaries and reject overlong or blank text", async () => {
    await withServer(createPrismaMock(), async (request) => {
        const title = "T".repeat(120);
        const description = "D".repeat(1000);
        const accepted = await request("/api/tasks", jsonRequest("POST", {
            title,
            description
        }));
        assert.equal(accepted.status, 201);

        for (const body of [
            { title: `${title}T` },
            { title: "Valid title", description: `${description}D` },
            { title: "Valid title", description: "   " }
        ]) {
            const response = await request("/api/tasks", jsonRequest("POST", body));
            assert.equal(response.status, 400);
        }

        const invalidPartialUpdate = await request(
            `/api/tasks/${TASK_A}`,
            jsonRequest("PUT", { description: "   " })
        );
        assert.equal(invalidPartialUpdate.status, 400);
    });
});

test("due-date validation accepts valid four-digit years below 0100", async () => {
    await withServer(createPrismaMock(), async (request) => {
        const response = await request("/api/tasks", jsonRequest("POST", {
            title: "Historical date",
            dueDate: "0099-01-01"
        }));

        assert.equal(response.status, 201);
        assert.equal((await response.json()).task.dueDate, "0099-01-01T00:00:00.000Z");
    });
});

test("task endpoints reject missing authentication", async () => {
    const unauthenticated = { "content-type": "application/json" };

    await withServer(createPrismaMock(), async (request) => {
        const responses = await Promise.all([
            request("/api/tasks", { method: "POST", headers: unauthenticated, body: JSON.stringify({ title: "Task" }) }),
            request("/api/tasks", { headers: unauthenticated }),
            request(`/api/tasks/${TASK_A}`, { headers: unauthenticated }),
            request(`/api/tasks/${TASK_A}`, { method: "PUT", headers: unauthenticated, body: JSON.stringify({ title: "Task" }) }),
            request(`/api/tasks/${TASK_A}`, { method: "DELETE", headers: unauthenticated })
        ]);

        assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401]);
    });
});

test("unexpected Prisma errors return a generic server error", async () => {
    const prisma = createPrismaMock();
    prisma.task.findMany = async () => {
        throw new Error("Sensitive database details");
    };

    await withServer(prisma, async (request) => {
        const response = await request("/api/tasks", {
            headers: { authorization: `Bearer ${tokenFor(USER_A)}` }
        });

        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: "Internal server error" });
    });
});

test("task endpoints return 400 for invalid UUIDs and 404 for missing tasks", async () => {
    await withServer(createPrismaMock(), async (request) => {
        const invalidIdResponses = await Promise.all([
            request("/api/tasks/not-a-uuid", { headers: { authorization: `Bearer ${tokenFor(USER_A)}` } }),
            request("/api/tasks/not-a-uuid", jsonRequest("PUT", { title: "Task" })),
            request("/api/tasks/not-a-uuid", {
                method: "DELETE",
                headers: { authorization: `Bearer ${tokenFor(USER_A)}` }
            })
        ]);
        assert.deepEqual(invalidIdResponses.map((response) => response.status), [400, 400, 400]);

        const missingIdResponses = await Promise.all([
            request(`/api/tasks/${TASK_A}`, { headers: { authorization: `Bearer ${tokenFor(USER_A)}` } }),
            request(`/api/tasks/${TASK_A}`, jsonRequest("PUT", { title: "Task" })),
            request(`/api/tasks/${TASK_A}`, {
                method: "DELETE",
                headers: { authorization: `Bearer ${tokenFor(USER_A)}` }
            })
        ]);
        assert.deepEqual(missingIdResponses.map((response) => response.status), [404, 404, 404]);
    });
});
