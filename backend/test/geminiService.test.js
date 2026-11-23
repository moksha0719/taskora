const assert = require("node:assert/strict");
const test = require("node:test");
const { getGeminiConfig } = require("../src/config/gemini");
const {
    createGeminiService,
    GeminiServiceError
} = require("../src/services/geminiService");

test("Gemini configuration trims values without exposing the API key", () => {
    assert.deepEqual(
        getGeminiConfig({
            GEMINI_API_KEY: "  test-api-key  ",
            GEMINI_MODEL: "  gemini-test-model  "
        }),
        { apiKey: "test-api-key", model: "gemini-test-model" }
    );
});

test("Gemini configuration rejects missing and example-placeholder values", () => {
    for (const env of [
        { GEMINI_MODEL: "gemini-test-model" },
        { GEMINI_API_KEY: "replace_with_a_gemini_api_key", GEMINI_MODEL: "gemini-test-model" },
        { GEMINI_API_KEY: "test-api-key", GEMINI_MODEL: "replace_with_a_model_name" }
    ]) {
        assert.throws(
            () => getGeminiConfig(env),
            { message: "Gemini API configuration is missing or invalid" }
        );
    }
});

test("Gemini service calls the configured model through the injected client", async () => {
    let receivedConfig;
    const service = createGeminiService({
        configProvider: () => ({ apiKey: "test-api-key", model: "gemini-test-model" }),
        clientFactory: (apiKey) => {
            receivedConfig = { apiKey };
            return {
                models: {
                    generateContent: async (request) => {
                        receivedConfig.request = request;
                        return { text: "A mocked response" };
                    }
                }
            };
        }
    });

    assert.equal(await service.generateContent("Test prompt"), "A mocked response");
    assert.deepEqual(receivedConfig, {
        apiKey: "test-api-key",
        request: { model: "gemini-test-model", contents: "Test prompt" }
    });
});

test("Gemini service forwards JSON response configuration to the model", async () => {
    let receivedRequest;
    const service = createGeminiService({
        configProvider: () => ({ apiKey: "test-api-key", model: "gemini-test-model" }),
        clientFactory: () => ({
            models: {
                generateContent: async (request) => {
                    receivedRequest = request;
                    return { text: "{\"response\":\"Done\",\"proposals\":[]}" };
                }
            }
        })
    });

    await service.generateContent("Return structured output", {
        responseMimeType: "application/json"
    });
    assert.deepEqual(receivedRequest, {
        model: "gemini-test-model",
        contents: "Return structured output",
        config: { responseMimeType: "application/json" }
    });
});

test("Gemini service maps configuration and provider failures to generic errors", async () => {
    const missingConfigService = createGeminiService({
        configProvider: () => {
            throw new Error("sensitive configuration detail");
        }
    });
    const failedRequestService = createGeminiService({
        configProvider: () => ({ apiKey: "test-api-key", model: "gemini-test-model" }),
        clientFactory: () => ({
            models: {
                generateContent: async () => {
                    throw new Error("sensitive provider detail");
                }
            }
        })
    });

    await assert.rejects(
        missingConfigService.generateContent("Test prompt"),
        (error) => error instanceof GeminiServiceError &&
            error.message === "Gemini service is not configured" &&
            error.code === "configuration"
    );
    await assert.rejects(
        failedRequestService.generateContent("Test prompt"),
        (error) => error instanceof GeminiServiceError &&
            error.message === "Gemini request failed" &&
            error.code === "provider" &&
            !error.message.includes("sensitive")
    );
});

test("Gemini service classifies SDK timeouts without exposing provider details", async () => {
    const service = createGeminiService({
        configProvider: () => ({ apiKey: "test-api-key", model: "gemini-test-model" }),
        clientFactory: () => ({
            models: {
                generateContent: async () => {
                    const error = new Error("sensitive timeout detail");
                    error.name = "APIConnectionTimeoutError";
                    throw error;
                }
            }
        })
    });

    await assert.rejects(
        service.generateContent("Test prompt"),
        (error) => error instanceof GeminiServiceError &&
            error.message === "Gemini request timed out" &&
            error.code === "timeout" &&
            !error.message.includes("sensitive")
    );
});

test("Gemini service rejects empty input before creating a client", async () => {
    let clientCreated = false;
    const service = createGeminiService({
        configProvider: () => ({ apiKey: "test-api-key", model: "gemini-test-model" }),
        clientFactory: () => {
            clientCreated = true;
            return {};
        }
    });

    await assert.rejects(service.generateContent("  "), TypeError);
    assert.equal(clientCreated, false);
});
