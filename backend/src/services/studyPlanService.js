const prisma = require("../lib/prisma");
const { validateStudyPlanCreateInput } = require("../validators/studyPlanValidators");
const defaultNotificationService = require("./notificationService");

const SUBJECT_DEFAULT_COLOR = "#9885E8";
const SUBJECTS_INCLUDE = { subjects: true };
const SCHEDULE_INCLUDE = {
    subjects: {
        include: { scheduleItems: true }
    }
};
const SCHEDULE_PERSISTENCE_INCLUDE = {
    subjects: {
        include: {
            scheduleItems: {
                include: { completions: true }
            }
        }
    }
};
const VALID_DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SCHEDULE_SESSIONS = 2400;
const SCHEDULE_SESSION_FIELDS = new Set([
    "subjectId",
    "subjectName",
    "dayOfWeek",
    "startMinuteOfDay",
    "durationMinutes",
    "kind"
]);

class StudyPlanServiceError extends Error {
    constructor(message, code, status) {
        super(message);
        this.name = "StudyPlanServiceError";
        this.code = code;
        this.status = status;
    }
}

function validationError(message) {
    return new StudyPlanServiceError(message, "INVALID_INPUT", 400);
}

function notFoundError() {
    return new StudyPlanServiceError("Study plan not found", "NOT_FOUND", 404);
}

function stateError(message) {
    return new StudyPlanServiceError(message, "INVALID_STATE", 409);
}

function conflictError() {
    return new StudyPlanServiceError("Study plan conflicts with an existing record", "CONFLICT", 409);
}

function mapPrismaError(error) {
    if (error && error.code === "P2002") {
        return conflictError();
    }
    if (error && error.code === "P2025") {
        return notFoundError();
    }
    return error;
}

function toPrismaDate(date) {
    return new Date(`${date}T00:00:00.000Z`);
}

function toPlanData(data) {
    return {
        title: data.title,
        startDate: toPrismaDate(data.startDate),
        endDate: toPrismaDate(data.endDate),
        timeZone: data.timeZone,
        weeklyTargetMinutes: data.weeklyTargetMinutes,
        studyDaysPerWeek: data.studyDaysPerWeek
    };
}

function toSubjectData(subject) {
    return {
        name: subject.name,
        code: subject.code || "",
        color: subject.color || SUBJECT_DEFAULT_COLOR,
        targetMinutesPerWeek: subject.targetMinutesPerWeek
    };
}

function dateOnly(value) {
    return value instanceof Date
        ? value.toISOString().slice(0, 10)
        : new Date(value).toISOString().slice(0, 10);
}

function normalizedSubjectData(subjects) {
    return subjects
        .map(toSubjectData)
        .sort((left, right) => {
            const leftName = left.name.toLowerCase();
            const rightName = right.name.toLowerCase();
            return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
        });
}

function hasSameSubjectData(existingSubjects, inputSubjects) {
    return JSON.stringify(normalizedSubjectData(existingSubjects)) ===
        JSON.stringify(normalizedSubjectData(inputSubjects));
}

function hasSamePlanData(existingPlan, input) {
    return existingPlan.title === input.title &&
        dateOnly(existingPlan.startDate) === input.startDate &&
        dateOnly(existingPlan.endDate) === input.endDate &&
        existingPlan.timeZone === input.timeZone &&
        existingPlan.weeklyTargetMinutes === input.weeklyTargetMinutes &&
        existingPlan.studyDaysPerWeek === input.studyDaysPerWeek &&
        hasSameSubjectData(existingPlan.subjects, input.subjects);
}

function validateInput(input) {
    const result = validateStudyPlanCreateInput(input);
    if (result.error) {
        throw validationError(result.error);
    }
    return result.data;
}

function assertUserId(userId) {
    if (typeof userId !== "string" || !userId.trim()) {
        throw validationError("Authenticated user ID is required");
    }
}

function validateScheduleReplacement(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw validationError("A schedule replacement object is required");
    }
    if (Object.keys(input).some((field) => field !== "schedule")) {
        throw validationError("Only the schedule field is supported");
    }
    if (
        !Array.isArray(input.schedule) ||
        input.schedule.length === 0 ||
        input.schedule.length > MAX_SCHEDULE_SESSIONS
    ) {
        throw validationError(`schedule must contain 1-${MAX_SCHEDULE_SESSIONS} sessions`);
    }

    return input.schedule.map((session, index) => {
        if (!session || typeof session !== "object" || Array.isArray(session)) {
            throw validationError(`Schedule session ${index} must be an object`);
        }
        if (Object.keys(session).some((field) => !SCHEDULE_SESSION_FIELDS.has(field))) {
            throw validationError(`Schedule session ${index} contains an unsupported field`);
        }
        if (!UUID_PATTERN.test(session.subjectId || "")) {
            throw validationError(`Schedule session ${index} must reference a valid subject ID`);
        }
        if (
            session.subjectName !== undefined &&
            (typeof session.subjectName !== "string" || !session.subjectName.trim())
        ) {
            throw validationError(`Schedule session ${index} subjectName must be a non-empty string`);
        }
        if (!VALID_DAYS.has(session.dayOfWeek)) {
            throw validationError(`Schedule session ${index} has an invalid dayOfWeek`);
        }
        if (
            !Number.isInteger(session.startMinuteOfDay) ||
            session.startMinuteOfDay < 0 ||
            session.startMinuteOfDay >= 1440 ||
            !Number.isInteger(session.durationMinutes) ||
            session.durationMinutes < 1 ||
            session.durationMinutes > 150 ||
            session.startMinuteOfDay + session.durationMinutes > 1440
        ) {
            throw validationError(`Schedule session ${index} must fit within one day and last 1-150 minutes`);
        }
        if (session.kind !== "STUDY") {
            throw validationError(`Schedule session ${index} kind must be STUDY`);
        }
        return {
            subjectId: session.subjectId,
            subjectName: session.subjectName,
            dayOfWeek: session.dayOfWeek,
            startMinuteOfDay: session.startMinuteOfDay,
            durationMinutes: session.durationMinutes,
            kind: session.kind
        };
    });
}

function createStudyPlanService({
    prismaClient = prisma,
    notificationService = null
} = {}) {
    async function createStudyPlan(userId, input) {
        assertUserId(userId);
        const data = validateInput(input);

        try {
            return await prismaClient.studyPlan.create({
                data: {
                    ...toPlanData(data),
                    userId,
                    status: "DRAFT",
                    subjects: { create: data.subjects.map(toSubjectData) }
                },
                include: SUBJECTS_INCLUDE
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function listStudyPlans(userId) {
        assertUserId(userId);

        try {
            return await prismaClient.studyPlan.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                include: SUBJECTS_INCLUDE
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function getActiveStudyPlan(userId) {
        assertUserId(userId);

        try {
            return await prismaClient.studyPlan.findFirst({
                where: { userId, status: "ACTIVE" },
                include: SCHEDULE_INCLUDE
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function getStudyPlanById(userId, planId) {
        assertUserId(userId);

        try {
            return await prismaClient.studyPlan.findFirst({
                where: { id: planId, userId },
                include: SCHEDULE_INCLUDE
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function updateStudyPlan(userId, planId, input) {
        assertUserId(userId);
        const data = validateInput(input);

        try {
            return await prismaClient.$transaction(async (transaction) => {
                const existingPlan = await transaction.studyPlan.findFirst({
                    where: { id: planId, userId },
                    include: SUBJECTS_INCLUDE
                });
                if (!existingPlan) {
                    throw notFoundError();
                }
                if (existingPlan.status !== "DRAFT") {
                    throw stateError("Only DRAFT study plans can be updated");
                }

                if (hasSamePlanData(existingPlan, data)) {
                    return existingPlan;
                }

                const updateResult = await transaction.studyPlan.updateMany({
                    where: {
                        id: planId,
                        userId,
                        status: "DRAFT",
                        updatedAt: existingPlan.updatedAt
                    },
                    data: toPlanData(data)
                });
                if (updateResult.count === 0) {
                    const latestPlan = await transaction.studyPlan.findFirst({
                        where: { id: planId, userId },
                        include: SUBJECTS_INCLUDE
                    });
                    if (!latestPlan) {
                        throw notFoundError();
                    }
                    if (latestPlan.status !== "DRAFT") {
                        throw stateError("Only DRAFT study plans can be updated");
                    }
                    if (hasSamePlanData(latestPlan, data)) {
                        return latestPlan;
                    }
                    throw conflictError();
                }

                if (!hasSameSubjectData(existingPlan.subjects, data.subjects)) {
                    await transaction.studySubject.deleteMany({
                        where: { planId }
                    });
                    await transaction.studySubject.createMany({
                        data: data.subjects.map((subject) => ({
                            ...toSubjectData(subject),
                            planId
                        }))
                    });
                }

                const updatedPlan = await transaction.studyPlan.findFirst({
                    where: { id: planId, userId },
                    include: SUBJECTS_INCLUDE
                });
                if (updatedPlan && notificationService) {
                    await notificationService.createNotification({
                        userId,
                        type: "study_plan_updated",
                        title: "Study plan updated",
                        message: `${updatedPlan.title} was updated.`,
                        actionUrl: `/study-plans/${planId}`,
                        studyPlanId: planId
                    }, transaction);
                }
                return updatedPlan;
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function replaceStudySchedule(userId, planId, input) {
        assertUserId(userId);
        if (typeof planId !== "string" || !UUID_PATTERN.test(planId)) {
            throw validationError("Study plan ID must be a valid UUID");
        }
        const sessions = validateScheduleReplacement(input);

        try {
            return await prismaClient.$transaction(async (transaction) => {
                const plan = await transaction.studyPlan.findFirst({
                    where: { id: planId, userId },
                    include: SCHEDULE_PERSISTENCE_INCLUDE
                });
                if (!plan) {
                    throw notFoundError();
                }
                if (plan.status === "ARCHIVED") {
                    throw stateError("Schedules cannot be saved for ARCHIVED study plans");
                }

                const subjectsById = new Map(plan.subjects.map((subject) => [subject.id, subject]));
                const totalsBySubject = new Map(plan.subjects.map((subject) => [subject.id, 0]));
                const days = new Set();
                const sessionsByDay = new Map();
                for (const session of sessions) {
                    const subject = subjectsById.get(session.subjectId);
                    if (!subject) {
                        throw validationError("Every schedule session must belong to a subject in this plan");
                    }
                    if (session.subjectName !== undefined && session.subjectName.trim() !== subject.name) {
                        throw validationError("Schedule subject names must match the current study plan");
                    }

                    totalsBySubject.set(
                        subject.id,
                        totalsBySubject.get(subject.id) + session.durationMinutes
                    );
                    days.add(session.dayOfWeek);
                    if (!sessionsByDay.has(session.dayOfWeek)) {
                        sessionsByDay.set(session.dayOfWeek, []);
                    }
                    sessionsByDay.get(session.dayOfWeek).push(session);
                }

                for (const subject of plan.subjects) {
                    if (totalsBySubject.get(subject.id) !== subject.targetMinutesPerWeek) {
                        throw validationError(
                            `Schedule sessions for ${subject.name} must total exactly ${subject.targetMinutesPerWeek} minutes`
                        );
                    }
                }
                if (days.size !== plan.studyDaysPerWeek) {
                    throw validationError(
                        `Schedule sessions must use exactly ${plan.studyDaysPerWeek} distinct study days`
                    );
                }
                for (const daySessions of sessionsByDay.values()) {
                    daySessions.sort((left, right) =>
                        left.startMinuteOfDay - right.startMinuteOfDay
                    );
                    for (let index = 1; index < daySessions.length; index += 1) {
                        const previous = daySessions[index - 1];
                        if (
                            daySessions[index].startMinuteOfDay <
                            previous.startMinuteOfDay + previous.durationMinutes
                        ) {
                            throw validationError("Study schedule sessions cannot overlap");
                        }
                    }
                }

                const hasCompletions = plan.subjects.some((subject) =>
                    subject.scheduleItems.some((item) => item.completions.length > 0)
                );
                if (hasCompletions) {
                    throw stateError("A schedule with completed sessions cannot be replaced");
                }

                const subjectIds = plan.subjects.map((subject) => subject.id);
                await transaction.scheduleItem.deleteMany({
                    where: { subjectId: { in: subjectIds } }
                });
                await transaction.scheduleItem.createMany({
                    data: sessions.map((session) => ({
                        subjectId: session.subjectId,
                        dayOfWeek: session.dayOfWeek,
                        startMinuteOfDay: session.startMinuteOfDay,
                        durationMinutes: session.durationMinutes,
                        kind: session.kind,
                        topics: []
                    }))
                });

                return transaction.studyPlan.findFirst({
                    where: { id: planId, userId },
                    include: SCHEDULE_INCLUDE
                });
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function deleteStudyPlan(userId, planId) {
        assertUserId(userId);

        try {
            return await prismaClient.$transaction(async (transaction) => {
                const existingPlan = await transaction.studyPlan.findFirst({
                    where: { id: planId, userId },
                    select: { status: true }
                });
                if (!existingPlan) {
                    throw notFoundError();
                }
                if (!["DRAFT", "ARCHIVED"].includes(existingPlan.status)) {
                    throw stateError("Only DRAFT or ARCHIVED study plans can be deleted");
                }

                const result = await transaction.studyPlan.deleteMany({
                    where: {
                        id: planId,
                        userId,
                        status: { in: ["DRAFT", "ARCHIVED"] }
                    }
                });
                if (result.count === 0) {
                    const currentPlan = await transaction.studyPlan.findFirst({
                        where: { id: planId, userId },
                        select: { status: true }
                    });
                    if (!currentPlan) {
                        throw notFoundError();
                    }
                    throw stateError("Only DRAFT or ARCHIVED study plans can be deleted");
                }

                return { id: planId };
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    return {
        createStudyPlan,
        listStudyPlans,
        getActiveStudyPlan,
        getStudyPlanById,
        updateStudyPlan,
        replaceStudySchedule,
        deleteStudyPlan
    };
}

const studyPlanService = createStudyPlanService({
    notificationService: defaultNotificationService
});

module.exports = {
    StudyPlanServiceError,
    createStudyPlanService,
    ...studyPlanService
};
