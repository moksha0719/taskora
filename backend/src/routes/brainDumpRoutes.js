const express = require("express");
const { rateLimit } = require("express-rate-limit");
const authenticateToken = require("../middleware/authenticateToken");
const { GeminiServiceError } = require("../services/geminiService");
const { BrainDumpOutputError } = require("../services/brainDumpService");
const { BrainDumpWorkflowServiceError } = require("../services/brainDumpWorkflowService");

const MAX_BRAIN_DUMP_LENGTH = 8000;

function validateBrainDumpInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "A JSON object is required" };
    }

    if (Object.keys(body).some((field) => field !== "text")) {
        return { error: "Only the text field is accepted" };
    }

    if (typeof body.text !== "string" || !body.text.trim()) {
        return { error: "Text must be a non-empty string" };
    }

    if (body.text.length > MAX_BRAIN_DUMP_LENGTH) {
        return { error: `Text must be ${MAX_BRAIN_DUMP_LENGTH} characters or fewer` };
    }

    return { text: body.text.trim() };
}

function sendBrainDumpServiceError(error, res) {
    if (error instanceof BrainDumpWorkflowServiceError) {
        return res.status(error.status).json({ error: error.message });
    }
    if (error instanceof BrainDumpOutputError) {
        return res.status(502).json({ error: "AI returned an invalid response" });
    }
    if (error instanceof GeminiServiceError) {
        if (error.code === "configuration") {
            return res.status(503).json({ error: "AI service is not configured" });
        }
        if (error.code === "timeout") {
            return res.status(504).json({ error: "AI response timed out" });
        }
        if (error.code === "provider") {
            return res.status(502).json({ error: "AI service is temporarily unavailable" });
        }
    }
    return null;
}

function createBrainDumpRouter(brainDumpService, workflowService) {
    const router = express.Router();
    const brainDumpRateLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        keyGenerator: (req) => req.user.id,
        message: { error: "Too many Brain Dump requests. Please try again later." }
    });

    router.use(authenticateToken);

    router.post("/", (req, res, next) => {
        const validation = validateBrainDumpInput(req.body);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }
        req.brainDumpText = validation.text;
        return next();
    }, brainDumpRateLimit, async (req, res, next) => {
        try {
            const brainDump = await workflowService.createBrainDump(
                req.user.id,
                req.brainDumpText
            );
            return res.status(201).json({ brainDump });
        } catch (error) {
            const response = sendBrainDumpServiceError(error, res);
            return response || next(error);
        }
    });

    router.get("/", async (req, res, next) => {
        try {
            const brainDumps = await workflowService.listBrainDumps(req.user.id);
            return res.json({ brainDumps });
        } catch (error) {
            const response = sendBrainDumpServiceError(error, res);
            return response || next(error);
        }
    });

    router.post("/process", (req, res, next) => {
        const validation = validateBrainDumpInput(req.body);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        req.brainDumpText = validation.text;
        return next();
    }, brainDumpRateLimit, async (req, res, next) => {
        try {
            const result = await brainDumpService.processText(req.brainDumpText);
            return res.json({ summary: result.summary, tasks: result.tasks });
        } catch (error) {
            const response = sendBrainDumpServiceError(error, res);
            if (response) {
                return response;
            }
            return next(error);
        }
    });

    router.get("/:brainDumpId", async (req, res, next) => {
        try {
            const brainDump = await workflowService.getBrainDump(
                req.user.id,
                req.params.brainDumpId
            );
            return res.json({ brainDump });
        } catch (error) {
            const response = sendBrainDumpServiceError(error, res);
            return response || next(error);
        }
    });

    router.post("/:brainDumpId/proposals/:proposalId/approve", async (req, res, next) => {
        try {
            const result = await workflowService.approveTaskProposal(
                req.user.id,
                req.params.brainDumpId,
                req.params.proposalId
            );
            return res.json(result);
        } catch (error) {
            const response = sendBrainDumpServiceError(error, res);
            return response || next(error);
        }
    });

    router.post("/:brainDumpId/proposals/:proposalId/reject", async (req, res, next) => {
        try {
            const result = await workflowService.rejectTaskProposal(
                req.user.id,
                req.params.brainDumpId,
                req.params.proposalId
            );
            return res.json(result);
        } catch (error) {
            const response = sendBrainDumpServiceError(error, res);
            return response || next(error);
        }
    });

    return router;
}

module.exports = createBrainDumpRouter;
