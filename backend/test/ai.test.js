const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");
const { createGeminiService, GeminiServiceError } = require("../src/services/geminiService");

const TEST_SECRET = "ai-api-test-secret-with-at-least-32-bytes";
const TEST_USER_ID = "33333333-3333-4333-8333-333333333333";
process.env.JWT_SECRET = TEST_SECRET;

function tokenFor(userId = TEST_USER_ID) {
    return jwt.sign({}, TEST_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        expiresIn: "1h",
        issuer: JWT_ISSUER,
        subject: userId
    });
}

async function withServer(aiService, run) {
    const server = createApp({ aiService }).listen(0);
    await once(server, "listening");
    const address = server.address();
    const request = (path, options = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, options);

    try {
        await run(request);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

function assistantRequest(message, options = {}) {
    return {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tokenFor()}`
        },
        body: JSON.stringify({ message, ...options })
    };
}

function mockedGeminiService(generateContent) {
    return createGeminiService({
        configProvider: () => ({ apiKey: "test-api-key", model: "gemini-test-model" }),
        clientFactory: () => ({
            models: {
                generateContent
            }
        })
    });
}

test("authenticated assistant requests return a consistent response", async () => {
    let receivedPrompt;
    const aiService = mockedGeminiService(async ({ contents }) => {
        receivedPrompt = contents;
        return { text: "A mocked assistant reply" };
    });

    await withServer(aiService, async (request) => {
        const response = await request("/api/ai/assistant", assistantRequest("  Help me plan today  "));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { response: "A mocked assistant reply" });
        assert.equal(receivedPrompt, "Help me plan today");
    });
});

test("assistant endpoint rejects missing or invalid authentication", async () => {
    let calls = 0;
    const aiService = mockedGeminiService(async () => {
        calls += 1;
        return { text: "Never returned" };
    });

    await withServer(aiService, async (request) => {
        const missing = await request("/api/ai/assistant", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Hello" })
        });
        const invalid = await request("/api/ai/assistant", {
            ...assistantRequest("Hello"),
            headers: {
                "content-type": "application/json",
                authorization: "Bearer invalid-token"
            }
        });

        assert.equal(missing.status, 401);
        assert.equal(invalid.status, 401);
        assert.equal(calls, 0);
    });
});

test("assistant endpoint validates message shape, length, and unsupported user IDs", async () => {
    let calls = 0;
    const aiService = mockedGeminiService(async () => {
        calls += 1;
        return { text: "A mocked assistant reply" };
    });

    await withServer(aiService, async (request) => {
        const invalidBodies = [
            null,
            [],
            {},
            { message: "" },
            { message: "   " },
            { message: 123 },
            { message: "x".repeat(4001) },
            { message: "Hello", userId: "another-user" }
        ];

        for (const body of invalidBodies) {
            const response = await request("/api/ai/assistant", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${tokenFor()}`
                },
                body: JSON.stringify(body)
            });
            assert.equal(response.status, 400);
        }

        const maximumLength = await request(
            "/api/ai/assistant",
            assistantRequest("x".repeat(4000))
        );
        assert.equal(maximumLength.status, 200);
        assert.equal(calls, 1);
    });
});

test("assistant endpoint maps configuration, provider, and timeout errors safely", async () => {
    const failures = [
        {
            code: "configuration",
            expectedStatus: 503,
            expectedBody: { error: "AI service is not configured" }
        },
        {
            code: "provider",
            expectedStatus: 502,
            expectedBody: { error: "AI service is temporarily unavailable" }
        },
        {
            code: "timeout",
            expectedStatus: 504,
            expectedBody: { error: "AI response timed out" }
        }
    ];

    for (const failure of failures) {
        const aiService = {
            generateContent: async () => {
                throw new GeminiServiceError("Sensitive provider detail", failure.code);
            }
        };

        await withServer(aiService, async (request) => {
            const response = await request("/api/ai/assistant", assistantRequest("Hello"));
            assert.equal(response.status, failure.expectedStatus);
            assert.deepEqual(await response.json(), failure.expectedBody);
        });
    }
});

test("assistant endpoint rate limits authenticated users", async () => {
    let calls = 0;
    const aiService = mockedGeminiService(async () => {
        calls += 1;
        return { text: "A mocked assistant reply" };
    });

    await withServer(aiService, async (request) => {
        const responses = [];
        for (let attempt = 0; attempt < 11; attempt += 1) {
            responses.push(await request("/api/ai/assistant", assistantRequest("Hello")));
        }

        assert.equal(responses.slice(0, 10).every((response) => response.status === 200), true);
        assert.equal(responses[10].status, 429);
        assert.equal(calls, 10);
    });
});
