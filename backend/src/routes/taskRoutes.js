const express = require("express");
const authenticateToken = require("../middleware/authenticateToken");
const { isValidTaskId, validateTaskInput } = require("../validators/taskValidators");
const { createTaskService, TaskServiceError } = require("../services/taskService");
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

function isPrismaNotFound(error) {
    return error && error.code === "P2025";
}

function createTaskRouter(prisma, notificationService, taskService = createTaskService({
    prismaClient: prisma
})) {
    const router = express.Router();
    router.use(authenticateToken);

    router.post("/", async (req, res, next) => {
        try {
            const task = await taskService.createTask(req.user.id, req.body);
            return res.status(201).json({ task });
        } catch (error) {
            if (error instanceof TaskServiceError) {
                return res.status(error.status).json({ error: error.message });
            }
            return next(error);
        }
    });

    router.get("/", async (req, res, next) => {
        try {
            const tasks = await prisma.task.findMany({
                where: { userId: req.user.id },
                orderBy: { createdAt: "desc" },
                select: SAFE_TASK_SELECT
            });

            return res.json({ tasks });
        } catch (error) {
            return next(error);
        }
    });

    router.get("/:id", async (req, res, next) => {
        if (!isValidTaskId(req.params.id)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        try {
            const task = await prisma.task.findFirst({
                where: { id: req.params.id, userId: req.user.id },
                select: SAFE_TASK_SELECT
            });

            if (!task) {
                return res.status(404).json({ error: "Task not found" });
            }

            return res.json({ task });
        } catch (error) {
            return next(error);
        }
    });

    router.put("/:id", async (req, res, next) => {
        if (!isValidTaskId(req.params.id)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        const validation = validateTaskInput(req.body, true);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        try {
            let task;
            if (validation.data.status === "COMPLETED" && notificationService) {
                task = await prisma.$transaction(async (transaction) => {
                    const completionResult = await transaction.task.updateMany({
                        where: {
                            id: req.params.id,
                            userId: req.user.id,
                            status: { not: "COMPLETED" }
                        },
                        data: validation.data
                    });
                    if (completionResult.count > 0) {
                        const updatedTask = await transaction.task.findFirst({
                            where: { id: req.params.id, userId: req.user.id },
                            select: SAFE_TASK_SELECT
                        });
                        if (!updatedTask) {
                            return null;
                        }
                        await notificationService.createNotification({
                            userId: req.user.id,
                            type: "task_completed",
                            title: "Task completed",
                            message: `${updatedTask.title} was marked complete.`,
                            actionUrl: "/tasks",
                            taskId: updatedTask.id,
                            dedupeKey: `task_completed:${req.user.id}:${updatedTask.id}`
                        }, transaction);
                        if (transaction.xPTransaction) {
                            await transaction.xPTransaction.createMany({
                                data: [{
                                    userId: req.user.id,
                                    amount: 10,
                                    reason: `Task completed: ${updatedTask.title}`,
                                    source: "task_completion",
                                    dedupeKey: `task_completion:${req.user.id}:${updatedTask.id}`
                                }],
                                skipDuplicates: true
                            });
                        }
                        return updatedTask;
                    }

                    return transaction.task.update({
                        where: { id: req.params.id, userId: req.user.id },
                        data: validation.data,
                        select: SAFE_TASK_SELECT
                    });
                });
                if (!task) {
                    return res.status(404).json({ error: "Task not found" });
                }
            } else {
                task = await prisma.task.update({
                    where: { id: req.params.id, userId: req.user.id },
                    data: validation.data,
                    select: SAFE_TASK_SELECT
                });
            }

            return res.json({ task });
        } catch (error) {
            if (isPrismaNotFound(error)) {
                return res.status(404).json({ error: "Task not found" });
            }
            return next(error);
        }
    });

    router.delete("/:id", async (req, res, next) => {
        if (!isValidTaskId(req.params.id)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        try {
            await prisma.task.delete({
                where: { id: req.params.id, userId: req.user.id }
            });

            return res.status(204).end();
        } catch (error) {
            if (isPrismaNotFound(error)) {
                return res.status(404).json({ error: "Task not found" });
            }
            return next(error);
        }
    });

    return router;
}

module.exports = createTaskRouter;
