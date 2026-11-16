const prisma = require("../lib/prisma");
const { validateStudyPlanCreateInput } = require("../validators/studyPlanValidators");

const SUBJECT_DEFAULT_COLOR = "#9885E8";
const SUBJECTS_INCLUDE = { subjects: true };
const SCHEDULE_INCLUDE = {
    subjects: {
        include: { scheduleItems: true }
    }
};

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

function createStudyPlanService({ prismaClient = prisma } = {}) {
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
                const updateResult = await transaction.studyPlan.updateMany({
                    where: { id: planId, userId, status: "DRAFT" },
                    data: toPlanData(data)
                });

                if (updateResult.count === 0) {
                    const existingPlan = await transaction.studyPlan.findFirst({
                        where: { id: planId, userId },
                        select: { status: true }
                    });
                    if (!existingPlan) {
                        throw notFoundError();
                    }
                    throw stateError("Only DRAFT study plans can be updated");
                }

                await transaction.studySubject.deleteMany({
                    where: { planId }
                });
                await transaction.studySubject.createMany({
                    data: data.subjects.map((subject) => ({
                        ...toSubjectData(subject),
                        planId
                    }))
                });

                return transaction.studyPlan.findFirst({
                    where: { id: planId, userId },
                    include: SUBJECTS_INCLUDE
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
        deleteStudyPlan
    };
}

const studyPlanService = createStudyPlanService();

module.exports = {
    StudyPlanServiceError,
    createStudyPlanService,
    ...studyPlanService
};
