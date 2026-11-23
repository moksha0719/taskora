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
const { createTaskService } = require("./services/taskService");
const { createAiConversationService } = require("./services/aiConversationService");
const { createBrainDumpWorkflowService } = require("./services/brainDumpWorkflowService");
const logSafeError = require("./lib/logSafeError");
const createProductRouter = require("./routes/productRoutes");
const { createFlashcardRouter } = require("./routes/flashcardRoutes");
const { createProfilePhotoStorage } = require("./services/profilePhotoStorage");

function createApp({
    prismaClient = prisma,
    aiService = geminiService,
    brainDumpProcessingService = brainDumpService,
    taskService,
    aiConversationService,
    brainDumpWorkflowService,
    studyPlanService,
    studyScheduleService = defaultStudyScheduleService,
    scheduleCompletionService = defaultScheduleCompletionService,
    notificationService,
    profilePhotoStorage,
    env = process.env
} = {}) {
    const photoStorage = profilePhotoStorage || createProfilePhotoStorage({
        directory: env.PROFILE_UPLOAD_DIR || undefined
    });
    const notifications = notificationService || createNotificationService({ prismaClient });
    const tasks = taskService || createTaskService({ prismaClient });
    const conversations = aiConversationService || createAiConversationService({
        prismaClient,
        aiService,
        taskService: tasks
    });
    const brainDumps = brainDumpWorkflowService || createBrainDumpWorkflowService({
        prismaClient,
        processingService: brainDumpProcessingService,
        taskService: tasks
    });
    const plans = studyPlanService || createStudyPlanService({
        prismaClient,
        notificationService: notifications
    });
    const app = express();
    const corsPolicy = createCorsPolicy(env);
    const JSON_BODY_LIMIT = "1mb";

    app.disable("x-powered-by");
    app.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        next();
    });
    if (env.TRUST_PROXY_HOPS !== undefined) {
        const trustedProxyHops = Number(env.TRUST_PROXY_HOPS);
        if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 1) {
            throw new Error("TRUST_PROXY_HOPS must be a positive integer");
        }
        app.set("trust proxy", trustedProxyHops);
    }

    app.use(corsPolicy.rejectUnapprovedOrigin);
    app.use(cors({ origin: corsPolicy.corsOrigin }));
    app.use("/uploads/profile-photos", express.static(photoStorage.directory, {
        dotfiles: "deny",
        index: false,
        setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    }));
    app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));
    app.use((req, res, next) => {
        const contentLength = req.headers["content-length"];
        const hasBody = (
            contentLength !== undefined && contentLength !== "0"
        ) || req.headers["transfer-encoding"] !== undefined;
        const contentType = req.headers["content-type"];
        const isWriteMethod = !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
        const isExplicitJsonOnlyRequest = Boolean(req.headers.authorization);
        const isJsonContentType = typeof contentType === "string" &&
            /^application\/json(?:\s*;|$)/i.test(contentType);
        const isProfilePhotoUpload = req.method === "PUT" &&
            req.path === "/api/auth/profile/avatar" &&
            typeof contentType === "string" &&
            /^image\/(?:jpeg|png|webp)(?:\s*;|$)/i.test(contentType);

        if (
            isWriteMethod &&
            hasBody &&
            isExplicitJsonOnlyRequest &&
            !isJsonContentType &&
            !isProfilePhotoUpload
        ) {
            return res.status(415).json({ error: "Unsupported content type" });
        }

        return next();
    });

    app.get("/health/live", (req, res) => {
        return res.json({ status: "ok" });
    });

    app.get("/health/ready", async (req, res) => {
        try {
            await prismaClient.$queryRaw`SELECT 1`;
            return res.json({ status: "ready" });
        } catch (error) {
            logSafeError("Database readiness check failed:", error);
            return res.status(503).json({ status: "not_ready" });
        }
    });

    app.get("/", (req, res) => {
        res.json({
            message: "Taskora Backend is running!"
        });
    });

    app.use("/api/auth", createAuthRouter(prismaClient, undefined, photoStorage));
    app.use("/api/tasks", createTaskRouter(prismaClient, notifications, tasks));
    app.use("/api/ai", createAiRouter(aiService, conversations));
    app.use("/api/brain-dumps", createBrainDumpRouter(brainDumpProcessingService, brainDumps));
    app.use(
        "/api/study-plans",
        createStudyPlanRouter(plans, studyScheduleService, scheduleCompletionService)
    );
    app.use("/api/notifications", createNotificationRouter(notifications));
    app.use("/api/flashcards", createFlashcardRouter(prismaClient));
    app.use("/api", createProductRouter(prismaClient));

    app.use((error, req, res, next) => {
        if (error && error.type === "entity.parse.failed") {
            return res.status(400).json({ error: "Invalid JSON payload" });
        }

        if (error && error.type === "entity.too.large") {
            return res.status(413).json({ error: "Request body exceeds the supported size limit" });
        }

        if (error && error.status === 415) {
            return res.status(415).json({ error: "Unsupported content type" });
        }

        logSafeError("Unhandled API error:", error);
        return res.status(500).json({ error: "Internal server error" });
    });

    return app;
}

module.exports = createApp;
