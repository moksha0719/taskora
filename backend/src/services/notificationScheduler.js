const prisma = require("../lib/prisma");
const { createNotificationService } = require("./notificationService");

const TASK_DUE_WINDOW_MS = 24 * 60 * 60 * 1000;
const STUDY_REMINDER_WINDOW_MS = 15 * 60 * 1000;
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAY_NAMES = {
    Mon: "MON",
    Tue: "TUE",
    Wed: "WED",
    Thu: "THU",
    Fri: "FRI",
    Sat: "SAT",
    Sun: "SUN"
};
const FORMATTERS = new Map();

function getFormatter(timeZone) {
    if (!FORMATTERS.has(timeZone)) {
        FORMATTERS.set(timeZone, new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }));
    }
    return FORMATTERS.get(timeZone);
}

function getZonedParts(date, timeZone) {
    const parts = Object.fromEntries(
        getFormatter(timeZone)
            .formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
    );
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        weekday: WEEKDAY_NAMES[parts.weekday],
        hour: Number(parts.hour),
        minute: Number(parts.minute)
    };
}

function localDateString(year, month, day) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateTimeToUtc(year, month, day, minuteOfDay, timeZone) {
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
    let candidate = targetWallTime;

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const observed = getZonedParts(new Date(candidate), timeZone);
        const observedWallTime = Date.UTC(
            observed.year,
            observed.month - 1,
            observed.day,
            observed.hour,
            observed.minute
        );
        const adjustment = targetWallTime - observedWallTime;
        if (adjustment === 0) {
            return new Date(candidate);
        }
        candidate += adjustment;
    }

    const finalParts = getZonedParts(new Date(candidate), timeZone);
    if (
        finalParts.year !== year ||
        finalParts.month !== month ||
        finalParts.day !== day ||
        finalParts.hour !== hour ||
        finalParts.minute !== minute
    ) {
        return null;
    }
    return new Date(candidate);
}

function getStudyReminderOccurrence(item, now, reminderWindowMs = STUDY_REMINDER_WINDOW_MS) {
    const plan = item.subject && item.subject.plan;
    if (!plan || !plan.timeZone || !DAY_NAMES.includes(item.dayOfWeek)) {
        return null;
    }

    const localNow = getZonedParts(now, plan.timeZone);
    const localMidnightUtc = Date.UTC(localNow.year, localNow.month - 1, localNow.day);
    const latestStart = now.getTime() + reminderWindowMs;

    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
        const candidateDate = new Date(localMidnightUtc + dayOffset * 24 * 60 * 60 * 1000);
        const dayOfWeek = DAY_NAMES[candidateDate.getUTCDay()];
        if (dayOfWeek !== item.dayOfWeek) {
            continue;
        }

        const year = candidateDate.getUTCFullYear();
        const month = candidateDate.getUTCMonth() + 1;
        const day = candidateDate.getUTCDate();
        const startsAt = localDateTimeToUtc(
            year,
            month,
            day,
            item.startMinuteOfDay,
            plan.timeZone
        );
        if (
            startsAt &&
            startsAt.getTime() > now.getTime() &&
            startsAt.getTime() <= latestStart
        ) {
            return {
                occurrenceDate: localDateString(year, month, day),
                startsAt
            };
        }
    }

    return null;
}

function createNotificationScheduler({
    prismaClient = prisma,
    notificationService = createNotificationService({ prismaClient }),
    clock = () => new Date(),
    intervalMs = 60 * 1000,
    setIntervalFunction = setInterval,
    clearIntervalFunction = clearInterval,
    onError = (error) => console.error(
        "Notification scheduler run failed:",
        error && error.name ? error.name : "Error"
    )
} = {}) {
    let timer = null;
    let activeRun = null;

    async function runNotifications() {
        const now = clock();
        const tasks = await prismaClient.task.findMany({
            where: {
                status: { not: "COMPLETED" },
                dueDate: {
                    gt: now,
                    lte: new Date(now.getTime() + TASK_DUE_WINDOW_MS)
                }
            },
            select: {
                id: true,
                userId: true,
                title: true,
                dueDate: true
            }
        });
        const scheduleItems = await prismaClient.scheduleItem.findMany({
            where: {
                subject: {
                    is: {
                        plan: {
                            is: { status: { in: ["DRAFT", "ACTIVE"] } }
                        }
                    }
                }
            },
            include: {
                subject: {
                    include: {
                        plan: {
                            select: {
                                id: true,
                                userId: true,
                                title: true,
                                timeZone: true,
                                status: true
                            }
                        }
                    }
                }
            }
        });

        let createdCount = 0;
        for (const task of tasks) {
            const result = await notificationService.createNotification({
                userId: task.userId,
                type: "task_due",
                title: "Task due soon",
                message: `${task.title} is due within 24 hours.`,
                actionUrl: `/tasks/${task.id}`,
                dedupeKey: `task_due:${task.id}:${task.dueDate.toISOString()}`,
                taskId: task.id
            });
            createdCount += Number(result) || 0;
        }

        for (const item of scheduleItems) {
            const occurrence = getStudyReminderOccurrence(item, now);
            if (!occurrence) {
                continue;
            }
            const plan = item.subject.plan;
            const result = await notificationService.createNotification({
                userId: plan.userId,
                type: "study_reminder",
                title: "Study session coming up",
                message: `${item.subject.name} starts in 15 minutes.`,
                actionUrl: `/study-plans/${plan.id}`,
                dedupeKey: `study_reminder:${item.id}:${occurrence.occurrenceDate}`,
                scheduleItemId: item.id
            });
            createdCount += Number(result) || 0;
        }
        return { createdCount };
    }

    function runOnce() {
        if (activeRun) {
            return Promise.resolve({ skipped: true });
        }
        const run = runNotifications();
        activeRun = run;
        return run.finally(() => {
            if (activeRun === run) {
                activeRun = null;
            }
        });
    }

    function start() {
        if (timer) {
            return stop;
        }
        const runSafely = () => {
            runOnce().catch(onError);
        };
        runSafely();
        timer = setIntervalFunction(runSafely, intervalMs);
        if (typeof timer.unref === "function") {
            timer.unref();
        }
        return stop;
    }

    function stop() {
        if (timer) {
            clearIntervalFunction(timer);
            timer = null;
        }
        return activeRun || Promise.resolve();
    }

    return { runOnce, start, stop };
}

module.exports = {
    createNotificationScheduler,
    getStudyReminderOccurrence,
    localDateTimeToUtc
};
