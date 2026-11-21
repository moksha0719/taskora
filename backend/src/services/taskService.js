const prisma = require("../lib/prisma");
const { validateTaskInput } = require("../validators/taskValidators");

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_TASK_SELECT = {
    id: true,
    title: true,
    description: true,
    category: true,
    tags: true,
    subtasks: true,
    status: true,
    priority: true,
    dueDate: true,
    createdAt: true,
    updatedAt: true
};

class TaskServiceError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "TaskServiceError";
        this.status = status;
    }
}

function createTaskService({ prismaClient = prisma } = {}) {
    async function createTask(userId, input, transactionClient = prismaClient) {
        if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId)) {
            throw new TaskServiceError("Authenticated user ID must be a valid UUID");
        }

        const validation = validateTaskInput(input);
        if (validation.error) {
            throw new TaskServiceError(validation.error);
        }

        return transactionClient.task.create({
            data: {
                ...validation.data,
                userId
            },
            select: SAFE_TASK_SELECT
        });
    }

    return { createTask };
}

module.exports = { TaskServiceError, createTaskService };
