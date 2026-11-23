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

function getErrorStatus(error) {
    const status = error && (error.status || error.statusCode);
    return Number(status);
}

function isRateLimitError(error) {
    if (!error) return false;
    const code = error.code === undefined ? "" : String(error.code).toUpperCase();
    const name = typeof error.name === "string" ? error.name.toUpperCase() : "";
    return getErrorStatus(error) === 429 ||
        ["429", "RESOURCE_EXHAUSTED", "RATE_LIMIT_EXCEEDED", "TOO_MANY_REQUESTS"].includes(code) ||
        ["RESOURCEEXHAUSTED", "TOOMANYREQUESTS"].includes(name);
}

function isTimeoutError(error) {
    if (!error) return false;
    const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
    const name = typeof error.name === "string" ? error.name : "";
    return getErrorStatus(error) === 504 ||
        ["APIConnectionTimeoutError", "RequestTimeoutError", "TimeoutError", "AbortError"].includes(name) ||
        ["ETIMEDOUT", "ECONNABORTED", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(code);
}

function createGeminiService({
    clientFactory = (apiKey) => new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS }
    }),
    configProvider = getGeminiConfig
} = {}) {
    async function generateContent(contents, generationConfig) {
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
            const request = {
                model: config.model,
                contents
            };
            if (generationConfig !== undefined) {
                request.config = generationConfig;
            }
            const response = await client.models.generateContent(request);

            if (typeof response.text !== "string" || !response.text.trim()) {
                throw new Error("Empty Gemini response");
            }

            return response.text;
        } catch (error) {
            if (isRateLimitError(error)) {
                throw new GeminiServiceError("Gemini request was rate limited", "rate_limit");
            }
            if (isTimeoutError(error)) {
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
