const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createNotificationScheduler,
    getStudyReminderOccurrence
} = require("../src/services/notificationScheduler");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SCHEDULE_ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("study reminder occurrence uses the plan timezone and local schedule day", () => {
    const occurrence = getStudyReminderOccurrence({
        id: SCHEDULE_ITEM_ID,
        dayOfWeek: "MON",
        startMinuteOfDay: 720,
        subject: {
            name: "Mathematics",
            plan: {
                timeZone: "Asia/Colombo",
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-12-20T00:00:00.000Z")
            }
        }
    }, new Date("2026-11-16T06:15:00.000Z"));

    assert.deepEqual(occurrence, {
        occurrenceDate: "2026-11-16",
        startsAt: new Date("2026-11-16T06:30:00.000Z")
    });
});

test("study reminders skip nonexistent local times during a daylight-saving transition", () => {
    const occurrence = getStudyReminderOccurrence({
        id: SCHEDULE_ITEM_ID,
        dayOfWeek: "SUN",
        startMinuteOfDay: 150,
        subject: {
            name: "Physics",
            plan: {
                timeZone: "America/New_York",
                startDate: new Date("2026-03-08T00:00:00.000Z"),
                endDate: new Date("2026-03-08T00:00:00.000Z")
            }
        }
    }, new Date("2026-03-08T06:00:00.000Z"));

    assert.equal(occurrence, null);
});

test("study reminders stay within inclusive plan dates in the plan timezone", () => {
    const item = {
        dayOfWeek: "MON",
        startMinuteOfDay: 720,
        subject: {
            name: "Mathematics",
            plan: {
                timeZone: "Asia/Colombo",
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-11-30T00:00:00.000Z")
            }
        }
    };
    const occurrenceForDate = (date) => getStudyReminderOccurrence(
        item,
        new Date(`${date}T06:15:00.000Z`)
    );

    assert.equal(occurrenceForDate("2026-11-09"), null);
    assert.equal(occurrenceForDate("2026-11-16").occurrenceDate, "2026-11-16");
    assert.equal(occurrenceForDate("2026-11-23").occurrenceDate, "2026-11-23");
    assert.equal(occurrenceForDate("2026-11-30").occurrenceDate, "2026-11-30");
    assert.equal(occurrenceForDate("2026-12-07"), null);
});

test("Colombo plan date uses its local date across a UTC day rollover", () => {
    const occurrence = getStudyReminderOccurrence({
        dayOfWeek: "MON",
        startMinuteOfDay: 30,
        subject: {
            name: "Physics",
            plan: {
                timeZone: "Asia/Colombo",
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-11-16T00:00:00.000Z")
            }
        }
    }, new Date("2026-11-15T18:45:00.000Z"));

    assert.deepEqual(occurrence, {
        occurrenceDate: "2026-11-16",
        startsAt: new Date("2026-11-15T19:00:00.000Z")
    });
});

test("scheduler emits due-task and study-session reminders once using database dedupe keys", async () => {
    const now = new Date("2026-11-16T06:15:00.000Z");
    const task = {
        id: TASK_ID,
        userId: USER_ID,
        title: "Finish assignment",
        dueDate: new Date("2026-11-16T18:00:00.000Z")
    };
    const scheduleItem = {
        id: SCHEDULE_ITEM_ID,
        dayOfWeek: "MON",
        startMinuteOfDay: 720,
        subject: {
            name: "Mathematics",
            plan: {
                id: PLAN_ID,
                userId: USER_ID,
                title: "Fall plan",
                timeZone: "Asia/Colombo",
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-12-20T00:00:00.000Z"),
                status: "ACTIVE"
            }
        }
    };
    const notificationInputs = [];
    const prismaCalls = [];
    const prismaClient = {
        task: {
            findMany: async (args) => {
                prismaCalls.push(["tasks", args]);
                return [task];
            }
        },
        scheduleItem: {
            findMany: async (args) => {
                prismaCalls.push(["scheduleItems", args]);
                return [scheduleItem];
            }
        }
    };
    const notificationService = {
        createNotification: async (input) => {
            notificationInputs.push(input);
            return notificationInputs.length <= 2 ? 1 : 0;
        }
    };
    const scheduler = createNotificationScheduler({
        prismaClient,
        notificationService,
        clock: () => now
    });

    assert.deepEqual(await scheduler.runOnce(), { createdCount: 2 });
    assert.deepEqual(await scheduler.runOnce(), { createdCount: 0 });
    assert.deepEqual(prismaCalls[0][1].where, {
        status: { not: "COMPLETED" },
        dueDate: {
            gt: now,
            lte: new Date("2026-11-17T06:15:00.000Z")
        }
    });
    assert.deepEqual(notificationInputs.map((input) => input.type), [
        "task_due",
        "study_reminder",
        "task_due",
        "study_reminder"
    ]);
    assert.equal(notificationInputs[0].userId, USER_ID);
    assert.equal(notificationInputs[0].dedupeKey, `task_due:${TASK_ID}:2026-11-16T18:00:00.000Z`);
    assert.equal(notificationInputs[1].userId, USER_ID);
    assert.equal(
        notificationInputs[1].dedupeKey,
        `study_reminder:${SCHEDULE_ITEM_ID}:2026-11-16`
    );
    assert.deepEqual(prismaCalls[1][1].where.subject.is.plan.is.status, {
        in: ["DRAFT", "ACTIVE"]
    });
    assert.equal(
        prismaCalls[1][1].include.subject.include.plan.select.startDate,
        true
    );
    assert.equal(
        prismaCalls[1][1].include.subject.include.plan.select.endDate,
        true
    );
});

test("scheduler excludes tasks outside the reminder window and completed tasks by query", async () => {
    const now = new Date("2026-11-16T06:15:00.000Z");
    let taskQuery;
    const scheduler = createNotificationScheduler({
        prismaClient: {
            task: {
                findMany: async (args) => {
                    taskQuery = args;
                    return [];
                }
            },
            scheduleItem: { findMany: async () => [] }
        },
        notificationService: { createNotification: async () => 1 },
        clock: () => now
    });

    assert.deepEqual(await scheduler.runOnce(), { createdCount: 0 });
    assert.deepEqual(taskQuery.where.status, { not: "COMPLETED" });
    assert.equal(taskQuery.where.dueDate.gt, now);
    assert.equal(
        taskQuery.where.dueDate.lte.getTime() - now.getTime(),
        24 * 60 * 60 * 1000
    );
});

test("scheduler intentionally skips reminders that became overdue during downtime", async () => {
    const now = new Date("2026-11-16T06:40:00.000Z");
    const overdueTask = {
        id: TASK_ID,
        userId: USER_ID,
        title: "Already due",
        dueDate: new Date("2026-11-16T06:39:00.000Z")
    };
    const pastSession = {
        id: SCHEDULE_ITEM_ID,
        dayOfWeek: "MON",
        startMinuteOfDay: 720,
        subject: {
            name: "Mathematics",
            plan: {
                id: PLAN_ID,
                userId: USER_ID,
                timeZone: "Asia/Colombo",
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-12-20T00:00:00.000Z"),
                status: "ACTIVE"
            }
        }
    };
    const notificationInputs = [];
    let taskQuery;
    const scheduler = createNotificationScheduler({
        prismaClient: {
            task: {
                findMany: async (args) => {
                    taskQuery = args;
                    return overdueTask.dueDate > args.where.dueDate.gt ? [overdueTask] : [];
                }
            },
            scheduleItem: { findMany: async () => [pastSession] }
        },
        notificationService: {
            createNotification: async (input) => {
                notificationInputs.push(input);
                return 1;
            }
        },
        clock: () => now
    });

    assert.deepEqual(await scheduler.runOnce(), { createdCount: 0 });
    assert.equal(taskQuery.where.dueDate.gt, now);
    assert.equal(notificationInputs.length, 0);
    assert.equal(getStudyReminderOccurrence(pastSession, now), null);
});

test("scheduler start is idempotent and stop waits for an active run", async () => {
    let resolveTasks;
    let intervalCallback;
    let intervalHandle;
    let clearedHandle;
    let taskQueries = 0;
    const prismaClient = {
        task: {
            findMany: async () => {
                taskQueries += 1;
                if (taskQueries === 1) {
                    return new Promise((resolve) => {
                        resolveTasks = resolve;
                    });
                }
                return [];
            }
        },
        scheduleItem: { findMany: async () => [] }
    };
    const scheduler = createNotificationScheduler({
        prismaClient,
        notificationService: { createNotification: async () => 1 },
        setIntervalFunction: (callback, delay) => {
            intervalCallback = callback;
            intervalHandle = { callback, delay, unref() {} };
            return intervalHandle;
        },
        clearIntervalFunction: (handle) => {
            clearedHandle = handle;
        }
    });

    scheduler.start();
    scheduler.start();
    assert.equal(typeof intervalCallback, "function");
    assert.equal(intervalHandle.delay, 60 * 1000);
    assert.deepEqual(await scheduler.runOnce(), { skipped: true });

    const stopPromise = scheduler.stop();
    assert.equal(clearedHandle, intervalHandle);
    resolveTasks([]);
    await stopPromise;
    assert.equal(taskQueries, 1);
});
