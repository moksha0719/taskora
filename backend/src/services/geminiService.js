const { GoogleGenAI } = require("@google/genai");
const { getGeminiConfig } = require("../config/gemini");

const GEMINI_REQUEST_TIMEOUT_MS = 20_000;

class GeminiServiceError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "GeminiServiceError";
        this.code = code;
    }
}

function createGeminiService({
    clientFactory = (apiKey) => new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS }
    }),
    configProvider = getGeminiConfig
} = {}) {
    async function generateContent(contents) {
        if (typeof contents !== "string" || !contents.trim()) {
            throw new TypeError("Gemini input must be a non-empty string");
        }

        let config;
        try {
            config = configProvider();
        } catch {
            throw new GeminiServiceError("Gemini service is not configured", "configuration");
        }

        try {
            const client = clientFactory(config.apiKey);
            const response = await client.models.generateContent({
                model: config.model,
                contents
            });

            if (typeof response.text !== "string" || !response.text.trim()) {
                throw new Error("Empty Gemini response");
            }

            return response.text;
        } catch (error) {
            const timedOut = error && [
                "APIConnectionTimeoutError",
                "RequestTimeoutError",
                "TimeoutError"
            ].includes(error.name);

            if (timedOut) {
                throw new GeminiServiceError("Gemini request timed out", "timeout");
            }

            throw new GeminiServiceError("Gemini request failed", "provider");
        }
    }

    return { generateContent };
}

const geminiService = createGeminiService();

module.exports = {
    GeminiServiceError,
    createGeminiService,
    generateContent: geminiService.generateContent
};
