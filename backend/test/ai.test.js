const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const { getGeminiConfig } = require("../src/config/gemini");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");
const { createGeminiService, GeminiServiceError } = require("../src/services/geminiService");
const { createAiConversationService } = require("../src/services/aiConversationService");

const TEST_SECRET = "ai-api-test-secret-with-at-least-32-bytes";
const TEST_USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";
const TEST_CONVERSATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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

async function withServer(aiService, run, aiConversationService) {
    const server = createApp({ aiService, aiConversationService }).listen(0);
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

test("assistant endpoint persists messages when given an owned conversation ID", async () => {
    let received;
    const aiService = mockedGeminiService(async () => {
        throw new Error("The direct provider must not run for conversation requests");
    });
    const conversationService = {
        sendMessage: async (userId, conversationId, input) => {
            received = { userId, conversationId, input };
            return {
                conversationId,
                userMessage: { id: "user-message", content: input.message },
                assistantMessage: {
                    id: "assistant-message",
                    content: "A persisted reply",
                    createdAt: "2026-11-21T00:00:00.000Z"
                },
                proposals: []
            };
        }
    };

    await withServer(aiService, async (request) => {
        const response = await request(
            "/api/ai/assistant",
            assistantRequest("Help me plan", { conversationId: TEST_CONVERSATION_ID })
        );
        assert.equal(response.status, 201);
        assert.equal((await response.json()).assistantMessage.content, "A persisted reply");
        assert.deepEqual(received, {
            userId: TEST_USER_ID,
            conversationId: TEST_CONVERSATION_ID,
            input: { message: "Help me plan" }
        });
    }, conversationService);
});

test("assistant route returns a safe 503 when the Gemini key or model is missing", async () => {
    for (const env of [
        { GEMINI_MODEL: "gemini-test-model" },
        { GEMINI_API_KEY: "test-api-key" }
    ]) {
        let clientCreated = false;
        const aiService = createGeminiService({
            configProvider: () => getGeminiConfig(env),
            clientFactory: () => {
                clientCreated = true;
                throw new Error("Client must not be created without complete configuration");
            }
        });

        await withServer(aiService, async (request) => {
            const response = await request("/api/ai/assistant", assistantRequest("Hello"));
            assert.equal(response.status, 503);
            assert.deepEqual(await response.json(), {
                error: "AI service is not configured"
            });
            assert.equal(clientCreated, false);
        });
    }
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
            { message: "Hello", userId: "another-user" },
            { message: "Hello", conversationId: "not-a-uuid" }
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
        },
        {
            code: "rate_limit",
            expectedStatus: 429,
            expectedBody: { error: "AI service rate limit reached. Please try again later." }
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

test("mock Gemini provider timeouts and rate limits map to safe API responses", async () => {
    const failures = [
        {
            error: () => Object.assign(new Error("sensitive provider timeout detail"), {
                name: "APIConnectionTimeoutError"
            }),
            expectedStatus: 504,
            expectedBody: { error: "AI response timed out" }
        },
        {
            error: () => Object.assign(new Error("sensitive provider quota detail"), {
                status: 429,
                code: "RESOURCE_EXHAUSTED"
            }),
            expectedStatus: 429,
            expectedBody: { error: "AI service rate limit reached. Please try again later." }
        }
    ];

    for (const failure of failures) {
        const aiService = mockedGeminiService(async () => {
            throw failure.error();
        });

        await withServer(aiService, async (request) => {
            const response = await request("/api/ai/assistant", assistantRequest("Hello"));
            assert.equal(response.status, failure.expectedStatus);
            const body = await response.json();
            assert.deepEqual(body, failure.expectedBody);
            assert.equal(JSON.stringify(body).includes("sensitive"), false);
        });
    }
});

test("conversation routes only expose conversations to their authenticated owner", async () => {
    const conversationQueries = [];
    let geminiCalls = 0;
    const aiService = mockedGeminiService(async () => {
        geminiCalls += 1;
        return {
            text: JSON.stringify({ response: "Reply", proposals: [] })
        };
    });
    const conversation = {
        id: TEST_CONVERSATION_ID,
        userId: TEST_USER_ID,
        title: "Owner conversation",
        messages: [],
        proposals: []
    };
    const conversationService = createAiConversationService({
        prismaClient: {
            aiConversation: {
                findFirst: async ({ where }) => {
                    conversationQueries.push(where);
                    return where.userId === TEST_USER_ID ? conversation : null;
                }
            }
        },
        aiService,
        taskService: { createTask: async () => ({}) }
    });

    await withServer(aiService, async (request) => {
        const owned = await request(`/api/ai/conversations/${TEST_CONVERSATION_ID}`, {
            headers: { authorization: `Bearer ${tokenFor(TEST_USER_ID)}` }
        });
        assert.equal(owned.status, 200);
        assert.equal((await owned.json()).conversation.userId, TEST_USER_ID);

        const crossUserRead = await request(`/api/ai/conversations/${TEST_CONVERSATION_ID}`, {
            headers: { authorization: `Bearer ${tokenFor(OTHER_USER_ID)}` }
        });
        assert.equal(crossUserRead.status, 404);
        assert.deepEqual(await crossUserRead.json(), {
            error: "AI conversation or proposal not found"
        });

        const crossUserMessage = await request(
            `/api/ai/conversations/${TEST_CONVERSATION_ID}/messages`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${tokenFor(OTHER_USER_ID)}`
                },
                body: JSON.stringify({ message: "Read this conversation" })
            }
        );
        assert.equal(crossUserMessage.status, 404);
        assert.equal(geminiCalls, 0);
    }, conversationService);

    assert.deepEqual(conversationQueries, [
        { id: TEST_CONVERSATION_ID, userId: TEST_USER_ID },
        { id: TEST_CONVERSATION_ID, userId: OTHER_USER_ID },
        { id: TEST_CONVERSATION_ID, userId: OTHER_USER_ID }
    ]);
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

test("conversation database writes have a separate per-user limit", async () => {
    let creates = 0;
    const conversationService = {
        createConversation: async (userId) => {
            creates += 1;
            return { id: `conversation-${userId}` };
        }
    };

    await withServer(mockedGeminiService(async () => ({ text: "Unused" })), async (request) => {
        const createRequest = (userId = TEST_USER_ID) => request("/api/ai/conversations", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${tokenFor(userId)}`
            },
            body: JSON.stringify({ title: "Exam preparation" })
        });

        const responses = [];
        for (let attempt = 0; attempt < 31; attempt += 1) {
            responses.push(await createRequest());
        }

        assert.equal(responses.slice(0, 30).every((response) => response.status === 201), true);
        assert.equal(responses[30].status, 429);
        assert.deepEqual(await responses[30].json(), {
            error: "Too many conversation updates. Please try again later."
        });

        const otherUserResponse = await createRequest("44444444-4444-4444-8444-444444444444");
        assert.equal(otherUserResponse.status, 201);
        assert.equal(creates, 31);
    }, conversationService);
});
