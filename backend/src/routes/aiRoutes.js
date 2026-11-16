const express = require("express");
const { rateLimit } = require("express-rate-limit");
const authenticateToken = require("../middleware/authenticateToken");
const { GeminiServiceError } = require("../services/geminiService");

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

function createAiRouter(geminiService) {
    const router = express.Router();
    const aiRateLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        keyGenerator: (req) => req.user.id,
        message: { error: "Too many AI requests. Please try again later." }
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

            return next(error);
        }
    });

    return router;
}

module.exports = createAiRouter;
