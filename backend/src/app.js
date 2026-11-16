const express = require("express");
const cors = require("cors");
const prisma = require("./lib/prisma");
const createAuthRouter = require("./routes/authRoutes");
const createTaskRouter = require("./routes/taskRoutes");
const createAiRouter = require("./routes/aiRoutes");
const geminiService = require("./services/geminiService");
const createBrainDumpRouter = require("./routes/brainDumpRoutes");
const brainDumpService = require("./services/brainDumpService");

function createApp({
    prismaClient = prisma,
    aiService = geminiService,
    brainDumpProcessingService = brainDumpService
} = {}) {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.get("/", (req, res) => {
        res.json({
            message: "Taskora Backend is running!"
        });
    });

    app.use("/api/auth", createAuthRouter(prismaClient));
    app.use("/api/tasks", createTaskRouter(prismaClient));
    app.use("/api/ai", createAiRouter(aiService));
    app.use("/api/brain-dumps", createBrainDumpRouter(brainDumpProcessingService));

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
