const express = require("express");
const { rateLimit } = require("express-rate-limit");
const authenticateToken = require("../middleware/authenticateToken");
const { GeminiServiceError } = require("../services/geminiService");
const { AiConversationServiceError } = require("../services/aiConversationService");

const MAX_ASSISTANT_MESSAGE_LENGTH = 4000;

function validateAssistantInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "A JSON object is required" };
    }

    if (Object.keys(body).some((field) => field !== "message")) {
        return { error: "Only the message field is accepted" };
    }

    if (typeof body.message !== "string" || !body.message.trim()) {
        return { error: "Message must be a non-empty string" };
    }

    if (body.message.length > MAX_ASSISTANT_MESSAGE_LENGTH) {
        return { error: `Message must be ${MAX_ASSISTANT_MESSAGE_LENGTH} characters or fewer` };
    }

    return { message: body.message.trim() };
}

function sendAiServiceError(error, res) {
    if (error instanceof AiConversationServiceError) {
        return res.status(error.status).json({ error: error.message });
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

function createAiRouter(geminiService, conversationService) {
    const router = express.Router();
    const aiRateLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        keyGenerator: (req) => req.user.id,
        message: { error: "Too many AI requests. Please try again later." }
    });
    const conversationWriteRateLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        keyGenerator: (req) => req.user.id,
        message: { error: "Too many conversation updates. Please try again later." }
    });

    router.use(authenticateToken);

    router.post("/assistant", aiRateLimit, async (req, res, next) => {
        const validation = validateAssistantInput(req.body);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        try {
            const response = await geminiService.generateContent(validation.message);
            return res.json({ response });
        } catch (error) {
            const response = sendAiServiceError(error, res);
            if (response) {
                return response;
            }
            return next(error);
        }
    });

    router.post("/conversations", conversationWriteRateLimit, async (req, res, next) => {
        try {
            const conversation = await conversationService.createConversation(req.user.id, req.body);
            return res.status(201).json({ conversation });
        } catch (error) {
            const response = sendAiServiceError(error, res);
            return response || next(error);
        }
    });

    router.get("/conversations", async (req, res, next) => {
        try {
            const conversations = await conversationService.listConversations(req.user.id);
            return res.json({ conversations });
        } catch (error) {
            const response = sendAiServiceError(error, res);
            return response || next(error);
        }
    });

    router.get("/conversations/:conversationId", async (req, res, next) => {
        try {
            const conversation = await conversationService.getConversation(
                req.user.id,
                req.params.conversationId
            );
            return res.json({ conversation });
        } catch (error) {
            const response = sendAiServiceError(error, res);
            return response || next(error);
        }
    });

    router.post("/conversations/:conversationId/messages", aiRateLimit, async (req, res, next) => {
        try {
            const result = await conversationService.sendMessage(
                req.user.id,
                req.params.conversationId,
                req.body
            );
            return res.status(201).json(result);
        } catch (error) {
            const response = sendAiServiceError(error, res);
            return response || next(error);
        }
    });

    router.post("/proposals/:proposalId/approve", conversationWriteRateLimit, async (req, res, next) => {
        try {
            const result = await conversationService.approveProposal(
                req.user.id,
                req.params.proposalId
            );
            return res.json(result);
        } catch (error) {
            const response = sendAiServiceError(error, res);
            return response || next(error);
        }
    });

    router.post("/proposals/:proposalId/reject", conversationWriteRateLimit, async (req, res, next) => {
        try {
            const result = await conversationService.rejectProposal(
                req.user.id,
                req.params.proposalId
            );
            return res.json(result);
        } catch (error) {
            const response = sendAiServiceError(error, res);
            return response || next(error);
        }
    });

    return router;
}

module.exports = createAiRouter;
