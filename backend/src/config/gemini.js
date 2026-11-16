function getGeminiConfig(env = process.env) {
    const apiKey = env.GEMINI_API_KEY;
    const model = env.GEMINI_MODEL;

    if (
        typeof apiKey !== "string" ||
        !apiKey.trim() ||
        apiKey.trim().toLowerCase().startsWith("replace_with_") ||
        typeof model !== "string" ||
        !model.trim() ||
        model.trim().toLowerCase().startsWith("replace_with_") ||
        model.trim().length > 128 ||
        /\s/.test(model.trim())
    ) {
        throw new Error("Gemini API configuration is missing or invalid");
    }

    return {
        apiKey: apiKey.trim(),
        model: model.trim()
    };
}

module.exports = { getGeminiConfig };
