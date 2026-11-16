const express = require("express");
const authenticateToken = require("../middleware/authenticateToken");

const TASK_STATUSES = new Set(["TODO", "IN_PROGRESS", "COMPLETED"]);
const TASK_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const TASK_FIELDS = new Set(["title", "description", "status", "priority", "dueDate"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;
const SAFE_TASK_SELECT = {
    id: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    dueDate: true,
    createdAt: true,
    updatedAt: true
};

function validateTaskInput(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "A JSON object is required" };
    }

    const keys = Object.keys(body);
    const unknownField = keys.find((key) => !TASK_FIELDS.has(key));
    if (unknownField) {
        return { error: `Unsupported task field: ${unknownField}` };
    }

    if (partial && keys.length === 0) {
        return { error: "At least one task field must be provided" };
    }

    if ((!partial || Object.hasOwn(body, "title")) &&
        (typeof body.title !== "string" || !body.title.trim())) {
        return { error: "Title must be a non-empty string" };
    }

    const data = {};
    for (const field of keys) {
        const value = body[field];

        if (field === "title") {
            data.title = value.trim();
        } else if (field === "description") {
            if (value !== null && typeof value !== "string") {
                return { error: "Description must be a string or null" };
            }
            data.description = value;
        } else if (field === "status") {
            if (!TASK_STATUSES.has(value)) {
                return { error: "Status must be TODO, IN_PROGRESS, or COMPLETED" };
            }
            data.status = value;
        } else if (field === "priority") {
            if (!TASK_PRIORITIES.has(value)) {
                return { error: "Priority must be LOW, MEDIUM, or HIGH" };
            }
            data.priority = value;
        } else if (field === "dueDate") {
            if (value === null) {
                data.dueDate = null;
                continue;
            }

            if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
                return { error: "Due date must be an ISO 8601 date or date-time, or null" };
            }

            const [year, month, day] = value.slice(0, 10).split("-").map(Number);
            const calendarDate = new Date(0);
            calendarDate.setUTCFullYear(year, month - 1, day);
            const dueDate = new Date(value);
            if (
                Number.isNaN(dueDate.getTime()) ||
                calendarDate.getUTCFullYear() !== year ||
                calendarDate.getUTCMonth() !== month - 1 ||
                calendarDate.getUTCDate() !== day
            ) {
                return { error: "Due date must be a valid ISO 8601 date or date-time, or null" };
            }
            data.dueDate = dueDate;
        }
    }

    return { data };
}

function isPrismaNotFound(error) {
    return error && error.code === "P2025";
}

function createTaskRouter(prisma) {
    const router = express.Router();
    router.use(authenticateToken);

    router.post("/", async (req, res, next) => {
        const validation = validateTaskInput(req.body);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        try {
            const task = await prisma.task.create({
                data: {
                    ...validation.data,
                    userId: req.user.id
                },
                select: SAFE_TASK_SELECT
            });

            return res.status(201).json({ task });
        } catch (error) {
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
        if (!UUID_PATTERN.test(req.params.id)) {
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
        if (!UUID_PATTERN.test(req.params.id)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        const validation = validateTaskInput(req.body, true);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        try {
            const task = await prisma.task.update({
                where: { id: req.params.id, userId: req.user.id },
                data: validation.data,
                select: SAFE_TASK_SELECT
            });

            return res.json({ task });
        } catch (error) {
            if (isPrismaNotFound(error)) {
                return res.status(404).json({ error: "Task not found" });
            }
            return next(error);
        }
    });

    router.delete("/:id", async (req, res, next) => {
        if (!UUID_PATTERN.test(req.params.id)) {
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
