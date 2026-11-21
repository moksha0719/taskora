"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function getSafeTestDatabaseUrl(value) {
    if (!value) {
        return null;
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error("TASKORA_TEST_DATABASE_URL must be a valid PostgreSQL URL");
    }

    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        url.hostname !== "127.0.0.1" ||
        !url.port ||
        !/^taskora_test_[a-z0-9_]+$/.test(databaseName)
    ) {
        throw new Error(
            "PostgreSQL integration tests require a loopback URL and a taskora_test_* database"
        );
    }

    return value;
}

const testDatabaseUrl = getSafeTestDatabaseUrl(process.env.TASKORA_TEST_DATABASE_URL);
if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET = "taskora-postgres-integration-test-only-secret";
}

async function listen(app) {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    return {
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`
    };
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

async function request(baseUrl, method, path, token, body) {
    const headers = {};
    if (token) {
        headers.authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
        headers["content-type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const responseBody = response.status === 204 ? null : await response.json();
    return { response, body: responseBody };
}

async function createUser(baseUrl, label) {
    const email = `${label}-${randomUUID()}@taskora.test`;
    const password = "Taskora-Test-12345";
    const registration = await request(baseUrl, "POST", "/api/auth/register", null, {
        name: `Integration ${label}`,
        email,
        password
    });
    assert.equal(registration.response.status, 202);

    const login = await request(baseUrl, "POST", "/api/auth/login", null, {
        email,
        password
    });
    assert.equal(login.response.status, 200);
    assert.ok(login.body.token);
    return { email, token: login.body.token, user: login.body.user };
}

function planInput(title) {
    return {
        title,
        startDate: "2026-11-16",
        endDate: "2026-12-20",
        timeZone: "UTC",
        weeklyTargetMinutes: 600,
        studyDaysPerWeek: 4,
        subjects: [
            { name: "Mathematics", targetMinutesPerWeek: 300 },
            { name: "Physics", targetMinutesPerWeek: 300 }
        ]
    };
}

test("Taskora PostgreSQL persistence, ownership, constraints, and transactions", {
    skip: testDatabaseUrl ? false : "Set TASKORA_TEST_DATABASE_URL to an isolated loopback test database"
}, async (t) => {
    const prisma = require("../../src/lib/prisma");
    const createApp = require("../../src/app");
    const { createNotificationService } = require("../../src/services/notificationService");
    const { createStudyPlanService } = require("../../src/services/studyPlanService");
    const { createProfilePhotoStorage } = require("../../src/services/profilePhotoStorage");

    const profilePhotoDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), "taskora-profile-photo-integration-")
    );
    const appServer = await listen(createApp({
        prismaClient: prisma,
        profilePhotoStorage: createProfilePhotoStorage({ directory: profilePhotoDirectory })
    }));
    const testUserIds = [];
    t.after(async () => {
        try {
            await close(appServer.server);
            if (testUserIds.length > 0) {
                await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
            }
        } finally {
            try {
                await fs.rm(profilePhotoDirectory, { recursive: true, force: true });
            } finally {
                await prisma.$disconnect();
            }
        }
    });

    const userA = await createUser(appServer.baseUrl, "user-a");
    testUserIds.push(userA.user.id);
    const userB = await createUser(appServer.baseUrl, "user-b");
    testUserIds.push(userB.user.id);
    const photoBytes = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII=",
        "base64"
    );
    const photoResponse = await fetch(`${appServer.baseUrl}/api/auth/profile/avatar`, {
        method: "PUT",
        headers: {
            authorization: `Bearer ${userA.token}`,
            "content-type": "image/png"
        },
        body: photoBytes
    });
    assert.equal(photoResponse.status, 200);
    const photoResult = await photoResponse.json();
    assert.match(photoResult.user.avatar, /^\/uploads\/profile-photos\//);
    const persistedAvatar = await prisma.user.findUnique({
        where: { id: userA.user.id },
        select: { avatar: true }
    });
    assert.equal(persistedAvatar.avatar, photoResult.user.avatar);
    const servedPhoto = await fetch(`${appServer.baseUrl}${persistedAvatar.avatar}`);
    assert.equal(servedPhoto.status, 200);
    assert.deepEqual(Buffer.from(await servedPhoto.arrayBuffer()), photoBytes);

    const me = await request(appServer.baseUrl, "GET", "/api/auth/me", userA.token);
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.id, userA.user.id);

    const duplicateRegistration = await request(
        appServer.baseUrl,
        "POST",
        "/api/auth/register",
        null,
        {
            name: "Duplicate User",
            email: userA.email,
            password: "Taskora-Test-12345"
        }
    );
    assert.equal(duplicateRegistration.response.status, 202);
    assert.equal(await prisma.user.count({ where: { email: userA.email } }), 1);

    const taskAResponse = await request(appServer.baseUrl, "POST", "/api/tasks", userA.token, {
        title: "User A integration task"
    });
    const taskBResponse = await request(appServer.baseUrl, "POST", "/api/tasks", userB.token, {
        title: "User B integration task"
    });
    assert.equal(taskAResponse.response.status, 201);
    assert.equal(taskBResponse.response.status, 201);
    const taskA = taskAResponse.body.task;
    const taskB = taskBResponse.body.task;
    const ownTask = await request(
        appServer.baseUrl,
        "GET",
        `/api/tasks/${taskA.id}`,
        userA.token
    );
    assert.equal(ownTask.response.status, 200);
    assert.equal(ownTask.body.task.id, taskA.id);

    const taskList = await request(appServer.baseUrl, "GET", "/api/tasks", userA.token);
    assert.deepEqual(taskList.body.tasks.map((task) => task.id), [taskA.id]);
    assert.equal(
        (await request(appServer.baseUrl, "GET", `/api/tasks/${taskB.id}`, userA.token)).response.status,
        404
    );
    assert.equal(
        (await request(appServer.baseUrl, "PUT", `/api/tasks/${taskB.id}`, userA.token, {
            title: "Unauthorized update"
        })).response.status,
        404
    );
    assert.equal(
        (await request(appServer.baseUrl, "DELETE", `/api/tasks/${taskB.id}`, userA.token)).response.status,
        404
    );

    const taskUpdate = await request(appServer.baseUrl, "PUT", `/api/tasks/${taskA.id}`, userA.token, {
        title: "Updated integration task",
        status: "IN_PROGRESS"
    });
    assert.equal(taskUpdate.response.status, 200);
    assert.equal(taskUpdate.body.task.status, "IN_PROGRESS");
    const taskCompletion = await request(
        appServer.baseUrl,
        "PUT",
        `/api/tasks/${taskA.id}`,
        userA.token,
        { status: "COMPLETED" }
    );
    assert.equal(taskCompletion.response.status, 200);
    assert.equal(taskCompletion.body.task.status, "COMPLETED");
    const taskCompletionNotification = await prisma.notification.findFirst({
        where: { userId: userA.user.id, taskId: taskA.id, type: "TASK_COMPLETED" }
    });
    assert.ok(taskCompletionNotification);

    const planAResponse = await request(
        appServer.baseUrl,
        "POST",
        "/api/study-plans",
        userA.token,
        planInput("User A plan")
    );
    const planBResponse = await request(
        appServer.baseUrl,
        "POST",
        "/api/study-plans",
        userB.token,
        planInput("User B plan")
    );
    assert.equal(planAResponse.response.status, 201);
    assert.equal(planBResponse.response.status, 201);
    const planA = planAResponse.body.studyPlan;
    const planB = planBResponse.body.studyPlan;
    const ownPlan = await request(
        appServer.baseUrl,
        "GET",
        `/api/study-plans/${planA.id}`,
        userA.token
    );
    assert.equal(ownPlan.response.status, 200);
    assert.equal(ownPlan.body.studyPlan.id, planA.id);

    assert.equal(
        (await request(appServer.baseUrl, "GET", `/api/study-plans/${planB.id}`, userA.token))
            .response.status,
        404
    );
    const planList = await request(appServer.baseUrl, "GET", "/api/study-plans", userA.token);
    assert.deepEqual(planList.body.studyPlans.map((plan) => plan.id), [planA.id]);

    const schedule = [];
    for (const dayOfWeek of ["MON", "TUE", "WED", "THU"]) {
        schedule.push({
            subjectId: planA.subjects[0].id,
            subjectName: planA.subjects[0].name,
            dayOfWeek,
            startMinuteOfDay: 480,
            durationMinutes: 75,
            kind: "STUDY"
        });
        schedule.push({
            subjectId: planA.subjects[1].id,
            subjectName: planA.subjects[1].name,
            dayOfWeek,
            startMinuteOfDay: 570,
            durationMinutes: 75,
            kind: "STUDY"
        });
    }
    const scheduleResponse = await request(
        appServer.baseUrl,
        "PUT",
        `/api/study-plans/${planA.id}/schedule`,
        userA.token,
        { schedule }
    );
    assert.equal(scheduleResponse.response.status, 200);
    assert.equal(
        scheduleResponse.body.studyPlan.subjects.reduce(
            (total, subject) => total + subject.scheduleItems.length,
            0
        ),
        8
    );
    const scheduleItem = scheduleResponse.body.studyPlan.subjects[0].scheduleItems[0];
    const invalidPlanTitle = `Invalid plan ${randomUUID()}`;
    await assert.rejects(prisma.studyPlan.create({
        data: {
            userId: userA.user.id,
            title: invalidPlanTitle,
            startDate: new Date("2026-11-16T00:00:00.000Z"),
            endDate: new Date("2026-12-20T00:00:00.000Z"),
            weeklyTargetMinutes: 599,
            studyDaysPerWeek: 4
        }
    }));
    assert.equal(await prisma.studyPlan.count({ where: { title: invalidPlanTitle } }), 0);

    await assert.rejects(prisma.scheduleItem.create({
        data: {
            subjectId: planA.subjects[0].id,
            dayOfWeek: "FRI",
            startMinuteOfDay: 480,
            durationMinutes: 151,
            kind: "STUDY"
        }
    }));
    assert.equal(
        await prisma.scheduleItem.count({
            where: { subjectId: planA.subjects[0].id, dayOfWeek: "FRI" }
        }),
        0
    );

    const completionPath =
        `/api/study-plans/${planA.id}/schedule-items/${scheduleItem.id}/completions/2026-11-18`;
    const firstCompletion = await request(
        appServer.baseUrl,
        "PUT",
        completionPath,
        userA.token,
        { actualDurationMinutes: 45 }
    );
    assert.equal(firstCompletion.response.status, 200);
    const updatedCompletion = await request(
        appServer.baseUrl,
        "PUT",
        completionPath,
        userA.token,
        { actualDurationMinutes: 50 }
    );
    assert.equal(updatedCompletion.response.status, 200);
    assert.equal(updatedCompletion.body.completion.id, firstCompletion.body.completion.id);
    assert.equal(updatedCompletion.body.completion.actualDurationMinutes, 50);

    const completionListPath =
        `/api/study-plans/${planA.id}/completions?from=2026-11-16&to=2026-11-25`;
    const completionList = await request(
        appServer.baseUrl,
        "GET",
        completionListPath,
        userA.token
    );
    assert.equal(completionList.response.status, 200);
    assert.equal(completionList.body.completions.length, 1);
    assert.equal(
        (await request(appServer.baseUrl, "GET", `/api/study-plans/${planA.id}/completions?from=2026-11-16&to=2026-11-25`, userB.token))
            .response.status,
        404
    );
    assert.equal(
        (await request(appServer.baseUrl, "PUT", completionPath, userB.token, {
            actualDurationMinutes: 60
        })).response.status,
        404
    );
    assert.equal(
        (await request(
            appServer.baseUrl,
            "DELETE",
            completionPath,
            userB.token
        )).response.status,
        404
    );

    const subjectReplacement = await request(
        appServer.baseUrl,
        "PUT",
        `/api/study-plans/${planA.id}`,
        userA.token,
        {
            ...planInput("Changed User A plan"),
            weeklyTargetMinutes: 600,
            subjects: [{ name: "Chemistry", targetMinutesPerWeek: 600 }]
        }
    );
    assert.equal(subjectReplacement.response.status, 409);

    const notifications = createNotificationService({ prismaClient: prisma });
    const dedupeKey = `taskora-test-${randomUUID()}`;
    const systemNotificationInput = {
        userId: userA.user.id,
        type: "system",
        title: "Integration notification",
        message: "Persistent notification test",
        dedupeKey
    };
    assert.equal(await notifications.createNotification(systemNotificationInput), 1);
    assert.equal(await notifications.createNotification(systemNotificationInput), 0);

    const notificationList = await request(
        appServer.baseUrl,
        "GET",
        "/api/notifications",
        userA.token
    );
    assert.equal(notificationList.response.status, 200);
    assert.equal(notificationList.body.notifications.length, 2);
    assert.equal(
        (await request(appServer.baseUrl, "GET", "/api/notifications", userB.token))
            .body.notifications.length,
        0
    );
    const unreadCount = await request(
        appServer.baseUrl,
        "GET",
        "/api/notifications/unread-count",
        userA.token
    );
    assert.equal(unreadCount.body.unreadCount, 2);
    const readNotification = await request(
        appServer.baseUrl,
        "PATCH",
        `/api/notifications/${taskCompletionNotification.id}/read`,
        userA.token
    );
    assert.equal(readNotification.response.status, 200);
    assert.equal(readNotification.body.notification.read, true);
    const markAllRead = await request(
        appServer.baseUrl,
        "PATCH",
        "/api/notifications/read-all",
        userA.token
    );
    assert.equal(markAllRead.response.status, 200);

    const systemNotification = await prisma.notification.findUnique({
        where: { dedupeKey },
        select: { id: true, readAt: true }
    });
    assert.ok(systemNotification);
    assert.ok(systemNotification.readAt);
    assert.equal(
        (await request(
            appServer.baseUrl,
            "DELETE",
            `/api/notifications/${systemNotification.id}`,
            userB.token
        )).response.status,
        404
    );
    assert.equal(
        (await request(
            appServer.baseUrl,
            "DELETE",
            `/api/notifications/${systemNotification.id}`,
            userA.token
        )).response.status,
        204
    );

    const persistedClientModule = require("../../build/generated/prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const freshClient = new persistedClientModule.PrismaClient({
        adapter: new PrismaPg({ connectionString: testDatabaseUrl })
    });
    try {
        const persistedUser = await freshClient.user.findUnique({
            where: { id: userA.user.id },
            select: { id: true, email: true }
        });
        assert.equal(persistedUser.email, userA.email);
        assert.equal(
            await freshClient.task.count({ where: { id: taskA.id, status: "COMPLETED" } }),
            1
        );
        assert.equal(
            await freshClient.scheduleItem.count({
                where: { subject: { is: { planId: planA.id } } }
            }),
            8
        );
        assert.equal(
            await freshClient.sessionCompletion.count({
                where: {
                    scheduleItemId: scheduleItem.id,
                    occurrenceDate: new Date("2026-11-18T00:00:00.000Z"),
                    actualDurationMinutes: 50
                }
            }),
            1
        );
        const persistedPlan = await freshClient.studyPlan.findUnique({
            where: { id: planA.id },
            include: { subjects: true }
        });
        assert.equal(persistedPlan.title, "User A plan");
        assert.equal(persistedPlan.subjects.length, 2);
    } finally {
        await freshClient.$disconnect();
    }

    const rollbackTaskResponse = await request(
        appServer.baseUrl,
        "POST",
        "/api/tasks",
        userA.token,
        { title: "Task for transaction rollback" }
    );
    const rollbackTask = rollbackTaskResponse.body.task;
    const failingNotificationService = {
        createNotification: async () => {
            throw new Error("Injected integration-test notification failure");
        }
    };
    const failingAppServer = await listen(createApp({
        prismaClient: prisma,
        notificationService: failingNotificationService
    }));
    try {
        const failedTaskCompletion = await request(
            failingAppServer.baseUrl,
            "PUT",
            `/api/tasks/${rollbackTask.id}`,
            userA.token,
            { status: "COMPLETED" }
        );
        assert.equal(failedTaskCompletion.response.status, 500);
        assert.equal(
            await prisma.task.count({ where: { id: rollbackTask.id, status: "TODO" } }),
            1
        );
        assert.equal(
            await prisma.notification.count({ where: { taskId: rollbackTask.id } }),
            0
        );

        const failedPlanUpdate = await request(
            failingAppServer.baseUrl,
            "PUT",
            `/api/study-plans/${planA.id}`,
            userA.token,
            { ...planInput("Rolled back plan title"), subjects: planInput("User A plan").subjects }
        );
        assert.equal(failedPlanUpdate.response.status, 500);
        assert.equal(
            (await prisma.studyPlan.findUnique({ where: { id: planA.id } })).title,
            "User A plan"
        );
    } finally {
        await close(failingAppServer.server);
    }

    assert.equal(
        (await request(appServer.baseUrl, "DELETE", `/api/tasks/${taskA.id}`, userA.token))
            .response.status,
        204
    );
    assert.equal(await prisma.task.findUnique({ where: { id: taskA.id } }), null);
    assert.equal(await prisma.notification.count({ where: { taskId: taskA.id } }), 0);

    const deleteCompletion = await request(
        appServer.baseUrl,
        "DELETE",
        completionPath,
        userA.token
    );
    assert.equal(deleteCompletion.response.status, 200);
    assert.equal(
        (await request(appServer.baseUrl, "GET", completionListPath, userA.token))
            .body.completions.length,
        0
    );

    await assert.rejects(
        prisma.task.create({
            data: {
                title: "Invalid foreign key test",
                userId: randomUUID()
            }
        }),
        (error) => error.code === "P2003"
    );
    assert.equal(
        await prisma.task.count({ where: { title: "Invalid foreign key test" } }),
        0
    );
    await assert.rejects(
        prisma.user.create({
            data: {
                name: "Duplicate email test",
                email: userA.email,
                password: "test-only-not-a-real-password-hash"
            }
        }),
        (error) => error.code === "P2002"
    );

    const taskBAfterOwnershipChecks = await prisma.task.findUnique({
        where: { id: taskB.id },
        select: { title: true }
    });
    assert.equal(taskBAfterOwnershipChecks.title, "User B integration task");
    assert.equal(
        (await request(appServer.baseUrl, "GET", "/api/notifications/unread-count", userA.token))
            .body.unreadCount,
        0
    );
});
