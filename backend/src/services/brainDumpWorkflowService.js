const prisma = require("../lib/prisma");
const { validateTaskInput } = require("../validators/taskValidators");
const { TaskServiceError } = require("./taskService");

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESOURCE_ID_PATTERN = USER_ID_PATTERN;
const TASK_FIELDS = new Set(["title", "description", "priority", "dueDate"]);
const BRAIN_DUMP_INCLUDE = {
    proposals: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }
};

class BrainDumpWorkflowServiceError extends Error {
    constructor(message, code, status) {
        super(message);
        this.name = "BrainDumpWorkflowServiceError";
        this.code = code;
        this.status = status;
    }
}

function validationError(message) {
    return new BrainDumpWorkflowServiceError(message, "INVALID_INPUT", 400);
}

function notFoundError() {
    return new BrainDumpWorkflowServiceError("Brain Dump or task proposal not found", "NOT_FOUND", 404);
}

function stateError(message) {
    return new BrainDumpWorkflowServiceError(message, "INVALID_STATE", 409);
}

function conflictError() {
    return new BrainDumpWorkflowServiceError("The task proposal conflicts with an existing record", "CONFLICT", 409);
}

function assertUuid(value, label) {
    if (typeof value !== "string" || !RESOURCE_ID_PATTERN.test(value)) {
        throw validationError(`${label} must be a valid UUID`);
    }
}

function validateProposedTask(proposal) {
    if (
        typeof proposal.title !== "string" ||
        !proposal.title.trim() ||
        proposal.title.trim().length > 120 ||
        (
            proposal.description !== null &&
            proposal.description !== undefined &&
            (
                typeof proposal.description !== "string" ||
                !proposal.description.trim() ||
                proposal.description.trim().length > 1000
            )
        ) ||
        !["LOW", "MEDIUM", "HIGH"].includes(proposal.priority)
    ) {
        throw stateError("The proposed task is no longer valid");
    }

    const data = {};
    for (const field of TASK_FIELDS) {
        if (proposal[field] !== null && proposal[field] !== undefined) {
            data[field] = field === "dueDate" && proposal[field] instanceof Date
                ? proposal[field].toISOString()
                : proposal[field];
        }
    }
    const validation = validateTaskInput(data);
    if (validation.error) {
        throw stateError("The proposed task is no longer valid");
    }
    return {
        ...validation.data,
        ...(validation.data.dueDate
            ? { dueDate: validation.data.dueDate.toISOString() }
            : {})
    };
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

function createBrainDumpWorkflowService({
    prismaClient = prisma,
    processingService,
    taskService,
    clock = () => new Date()
} = {}) {
    if (!processingService || typeof processingService.processText !== "function") {
        throw new TypeError("A Brain Dump processing service is required");
    }
    if (!taskService || typeof taskService.createTask !== "function") {
        throw new TypeError("A task service is required");
    }

    async function createBrainDump(userId, inputText) {
        assertUuid(userId, "Authenticated user ID");
        if (typeof inputText !== "string" || !inputText.trim() || inputText.trim().length > 8000) {
            throw validationError("Brain Dump text must contain 1-8000 characters");
        }

        const text = inputText.trim();
        const output = await processingService.processText(text);
        try {
            return await prismaClient.$transaction(async (transaction) =>
                transaction.brainDump.create({
                    data: {
                        userId,
                        inputText: text,
                        summary: output.summary,
                        proposals: {
                            create: output.tasks.map((task) => ({
                                title: task.title,
                                description: task.description || null,
                                priority: task.priority,
                                dueDate: task.dueDate ? new Date(task.dueDate) : null
                            }))
                        }
                    },
                    include: BRAIN_DUMP_INCLUDE
                })
            );
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function listBrainDumps(userId) {
        assertUuid(userId, "Authenticated user ID");
        try {
            return await prismaClient.brainDump.findMany({
                where: { userId },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                take: 50,
                include: BRAIN_DUMP_INCLUDE
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function getBrainDump(userId, brainDumpId) {
        assertUuid(userId, "Authenticated user ID");
        assertUuid(brainDumpId, "Brain Dump ID");
        try {
            const brainDump = await prismaClient.brainDump.findFirst({
                where: { id: brainDumpId, userId },
                include: BRAIN_DUMP_INCLUDE
            });
            if (!brainDump) {
                throw notFoundError();
            }
            return brainDump;
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function decideTaskProposal(userId, brainDumpId, proposalId, decision) {
        assertUuid(userId, "Authenticated user ID");
        assertUuid(brainDumpId, "Brain Dump ID");
        assertUuid(proposalId, "Task proposal ID");
        const now = clock();

        try {
            return await prismaClient.$transaction(async (transaction) => {
                const proposal = await transaction.brainDumpTaskProposal.findFirst({
                    where: { id: proposalId, brainDumpId, userId }
                });
                if (!proposal) {
                    throw notFoundError();
                }
                if (proposal.status !== "PENDING") {
                    throw stateError("This task proposal has already been resolved");
                }

                if (decision === "REJECTED") {
                    const rejected = await transaction.brainDumpTaskProposal.updateMany({
                        where: {
                            id: proposalId,
                            brainDumpId,
                            userId,
                            status: "PENDING"
                        },
                        data: { status: "REJECTED", resolvedAt: now }
                    });
                    if (rejected.count === 0) {
                        throw stateError("This task proposal has already been resolved");
                    }
                    return transaction.brainDumpTaskProposal.findFirst({
                        where: { id: proposalId, brainDumpId, userId }
                    });
                }

                const taskData = validateProposedTask(proposal);
                const approved = await transaction.brainDumpTaskProposal.updateMany({
                    where: {
                        id: proposalId,
                        brainDumpId,
                        userId,
                        status: "PENDING"
                    },
                    data: { status: "APPROVED", resolvedAt: now }
                });
                if (approved.count === 0) {
                    throw stateError("This task proposal has already been resolved");
                }

                let task;
                try {
                    task = await taskService.createTask(userId, taskData, transaction);
                } catch (error) {
                    if (error instanceof TaskServiceError) {
                        throw stateError("The proposed task is no longer valid");
                    }
                    throw error;
                }
                const updatedProposal = await transaction.brainDumpTaskProposal.update({
                    where: { id: proposalId },
                    data: { approvedTaskId: task.id }
                });
                return { proposal: updatedProposal, task };
            });
        } catch (error) {
            throw mapPrismaError(error);
        }
    }

    async function approveTaskProposal(userId, brainDumpId, proposalId) {
        return decideTaskProposal(userId, brainDumpId, proposalId, "APPROVED");
    }

    async function rejectTaskProposal(userId, brainDumpId, proposalId) {
        return decideTaskProposal(userId, brainDumpId, proposalId, "REJECTED");
    }

    return {
        createBrainDump,
        listBrainDumps,
        getBrainDump,
        approveTaskProposal,
        rejectTaskProposal
    };
}

module.exports = {
    BrainDumpWorkflowServiceError,
    createBrainDumpWorkflowService
};
