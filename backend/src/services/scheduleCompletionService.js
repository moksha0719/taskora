const prisma = require("../lib/prisma");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPLETION_FIELDS = new Set(["occurrenceDate", "actualDurationMinutes"]);
const MAX_PRISMA_INT = 2147483647;

class ScheduleCompletionServiceError extends Error {
    constructor(message, code, status) {
        super(message);
        this.name = "ScheduleCompletionServiceError";
        this.code = code;
        this.status = status;
    }
}

function validationError(message) {
    return new ScheduleCompletionServiceError(message, "INVALID_INPUT", 400);
}

function planNotFoundError() {
    return new ScheduleCompletionServiceError("Study plan not found", "PLAN_NOT_FOUND", 404);
}

function scheduleItemNotFoundError() {
    return new ScheduleCompletionServiceError(
        "Schedule item not found in the requested study plan",
        "SCHEDULE_ITEM_NOT_FOUND",
        404
    );
}

function completionNotFoundError() {
    return new ScheduleCompletionServiceError(
        "Schedule completion not found",
        "COMPLETION_NOT_FOUND",
        404
    );
}

function mapPrismaError(error) {
    if (error && error.code === "P2002") {
        return new ScheduleCompletionServiceError(
            "A completion already exists for this schedule item and date",
            "CONFLICT",
            409
        );
    }
    if (error && error.code === "P2025") {
        return completionNotFoundError();
    }
    return error;
}

function assertUuid(value, label) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
        throw validationError(`${label} must be a valid UUID`);
    }
}

function validateOccurrenceDate(value) {
    if (typeof value !== "string") {
        throw validationError("Occurrence date must be a valid YYYY-MM-DD date");
    }

    const match = DATE_PATTERN.exec(value);
    if (!match) {
        throw validationError("Occurrence date must be a valid YYYY-MM-DD date");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const calendarDate = new Date(0);
    calendarDate.setUTCFullYear(year, month - 1, day);

    if (
        year < 1 ||
        month < 1 ||
        month > 12 ||
        calendarDate.getUTCFullYear() !== year ||
        calendarDate.getUTCMonth() !== month - 1 ||
        calendarDate.getUTCDate() !== day
    ) {
        throw validationError("Occurrence date must be a valid YYYY-MM-DD date");
    }

    return new Date(`${value}T00:00:00.000Z`);
}

function validateCompletionInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw validationError("A completion input object is required");
    }

    const unsupportedField = Object.keys(input).find((field) => !COMPLETION_FIELDS.has(field));
    if (unsupportedField) {
        throw validationError(`Unsupported completion field: ${unsupportedField}`);
    }

    const occurrenceDate = validateOccurrenceDate(input.occurrenceDate);
    const actualDurationMinutes = Object.hasOwn(input, "actualDurationMinutes")
        ? input.actualDurationMinutes
        : null;

    if (
        actualDurationMinutes !== null &&
        (
            !Number.isSafeInteger(actualDurationMinutes) ||
            actualDurationMinutes <= 0 ||
            actualDurationMinutes > MAX_PRISMA_INT
        )
    ) {
        throw validationError("Actual duration minutes must be a positive Prisma integer or null");
    }

    return { occurrenceDate, actualDurationMinutes };
}

async function assertPlanAndScheduleItemOwnership(
    transaction,
    userId,
    planId,
    scheduleItemId,
    occurrenceDate
) {
    const plan = await transaction.studyPlan.findFirst({
        where: { id: planId, userId },
        select: { id: true, startDate: true, endDate: true }
    });
    if (!plan) {
        throw planNotFoundError();
    }

    const scheduleItem = await transaction.scheduleItem.findFirst({
        where: {
            id: scheduleItemId,
            subject: {
                is: {
                    planId,
                    plan: {
                        is: { id: planId, userId }
                    }
                }
            }
        },
        select: { id: true }
    });
    if (!scheduleItem) {
        throw scheduleItemNotFoundError();
    }

    if (occurrenceDate) {
        const occurrenceDateOnly = occurrenceDate.toISOString().slice(0, 10);
        const startDateOnly = plan.startDate.toISOString().slice(0, 10);
        const endDateOnly = plan.endDate.toISOString().slice(0, 10);
        if (occurrenceDateOnly < startDateOnly || occurrenceDateOnly > endDateOnly) {
            throw validationError("Occurrence date must fall within the study plan date range");
        }
    }
}

function createScheduleCompletionService({ prismaClient = prisma } = {}) {
    async function listScheduleCompletions(userId, planId, from, to) {
        assertUuid(userId, "Authenticated user ID");
        assertUuid(planId, "Study plan ID");
        const fromDate = validateOccurrenceDate(from);
        const toDate = validateOccurrenceDate(to);
        if (fromDate >= toDate) {
            throw validationError("The to date must be after the from date");
        }

        try {
            const plan = await prismaClient.studyPlan.findFirst({
                where: { id: planId, userId },
                select: { id: true }
            });
            if (!plan) {
                throw planNotFoundError();
            }

            return await prismaClient.sessionCompletion.findMany({
                where: {
                    occurrenceDate: { gte: fromDate, lt: toDate },
                    scheduleItem: {
                        is: {
                            subject: {
                                is: {
                                    planId,
                                    plan: { is: { id: planId, userId } }
                                }
                            }
                        }
                    }
                },
                orderBy: [
                    { occurrenceDate: "asc" },
                    { scheduleItemId: "asc" }
                ],
                select: {
                    id: true,
                    scheduleItemId: true,
                    occurrenceDate: true,
                    completedAt: true,
                    actualDurationMinutes: true
                }
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function upsertScheduleCompletion(userId, planId, scheduleItemId, input) {
        assertUuid(userId, "Authenticated user ID");
        assertUuid(planId, "Study plan ID");
        assertUuid(scheduleItemId, "Schedule item ID");
        const { occurrenceDate, actualDurationMinutes } = validateCompletionInput(input);

        try {
            return await prismaClient.$transaction(async (transaction) => {
                await assertPlanAndScheduleItemOwnership(
                    transaction,
                    userId,
                    planId,
                    scheduleItemId,
                    occurrenceDate
                );

                return transaction.sessionCompletion.upsert({
                    where: {
                        scheduleItemId_occurrenceDate: {
                            scheduleItemId,
                            occurrenceDate
                        }
                    },
                    create: {
                        scheduleItemId,
                        occurrenceDate,
                        actualDurationMinutes
                    },
                    update: { actualDurationMinutes }
                });
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function deleteScheduleCompletion(userId, planId, scheduleItemId, occurrenceDateInput) {
        assertUuid(userId, "Authenticated user ID");
        assertUuid(planId, "Study plan ID");
        assertUuid(scheduleItemId, "Schedule item ID");
        const occurrenceDate = validateOccurrenceDate(occurrenceDateInput);

        try {
            return await prismaClient.$transaction(async (transaction) => {
                await assertPlanAndScheduleItemOwnership(
                    transaction,
                    userId,
                    planId,
                    scheduleItemId
                );

                const result = await transaction.sessionCompletion.deleteMany({
                    where: { scheduleItemId, occurrenceDate }
                });
                if (result.count === 0) {
                    throw completionNotFoundError();
                }
                return { scheduleItemId, occurrenceDate };
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    return {
        listScheduleCompletions,
        upsertScheduleCompletion,
        deleteScheduleCompletion
    };
}

const scheduleCompletionService = createScheduleCompletionService();

module.exports = {
    ScheduleCompletionServiceError,
    createScheduleCompletionService,
    ...scheduleCompletionService
};
