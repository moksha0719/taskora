const express = require("express");
const cors = require("cors");
const prisma = require("./lib/prisma");
const { createCorsPolicy } = require("./config/cors");
const createAuthRouter = require("./routes/authRoutes");
const createTaskRouter = require("./routes/taskRoutes");
const createAiRouter = require("./routes/aiRoutes");
const geminiService = require("./services/geminiService");
const createBrainDumpRouter = require("./routes/brainDumpRoutes");
const brainDumpService = require("./services/brainDumpService");
const createStudyPlanRouter = require("./routes/studyPlanRoutes");
const { createStudyPlanService } = require("./services/studyPlanService");
const defaultStudyScheduleService = require("./services/studyScheduleService");
const defaultScheduleCompletionService = require("./services/scheduleCompletionService");
const createNotificationRouter = require("./routes/notificationRoutes");
const { createNotificationService } = require("./services/notificationService");

function createApp({
    prismaClient = prisma,
    aiService = geminiService,
    brainDumpProcessingService = brainDumpService,
    studyPlanService,
    studyScheduleService = defaultStudyScheduleService,
    scheduleCompletionService = defaultScheduleCompletionService,
    notificationService,
    env = process.env
} = {}) {
    const notifications = notificationService || createNotificationService({ prismaClient });
    const plans = studyPlanService || createStudyPlanService({
        prismaClient,
        notificationService: notifications
    });
    const app = express();
    const corsPolicy = createCorsPolicy(env);

    app.use(corsPolicy.rejectUnapprovedOrigin);
    app.use(cors({ origin: corsPolicy.corsOrigin }));
    app.use(express.json());

    app.get("/health/live", (req, res) => {
        return res.json({ status: "ok" });
    });

    app.get("/health/ready", async (req, res) => {
        try {
            await prismaClient.$queryRaw`SELECT 1`;
            return res.json({ status: "ready" });
        } catch (error) {
            console.error(
                "Database readiness check failed:",
                error && error.name ? error.name : "Error"
            );
            return res.status(503).json({ status: "not_ready" });
        }
    });

    app.get("/", (req, res) => {
        res.json({
            message: "Taskora Backend is running!"
        });
    });

    app.use("/api/auth", createAuthRouter(prismaClient));
    app.use("/api/tasks", createTaskRouter(prismaClient, notifications));
    app.use("/api/ai", createAiRouter(aiService));
    app.use("/api/brain-dumps", createBrainDumpRouter(brainDumpProcessingService));
    app.use(
        "/api/study-plans",
        createStudyPlanRouter(plans, studyScheduleService, scheduleCompletionService)
    );
    app.use("/api/notifications", createNotificationRouter(notifications));

    app.use((error, req, res, next) => {
        if (error.type === "entity.parse.failed") {
            return res.status(400).json({ error: "Invalid JSON payload" });
        }

        console.error("Unhandled API error:", error.name || "Error");
        return res.status(500).json({ error: "Internal server error" });
    });

    return app;
}

module.exports = createApp;
