const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");
const { createGeminiService, GeminiServiceError } = require("../src/services/geminiService");
const { createBrainDumpService } = require("../src/services/brainDumpService");

const TEST_SECRET = "brain-dump-test-secret-with-at-least-32-bytes";
const USER_A = "44444444-4444-4444-8444-444444444444";
const USER_B = "55555555-5555-4555-8555-555555555555";
process.env.JWT_SECRET = TEST_SECRET;

function tokenFor(userId = USER_A) {
    return jwt.sign({}, TEST_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        expiresIn: "1h",
        issuer: JWT_ISSUER,
        subject: userId
    });
}

async function withServer(brainDumpProcessingService, run) {
    const server = createApp({ brainDumpProcessingService }).listen(0);
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

function brainDumpRequest(text, userId = USER_A, extraFields = {}) {
    return {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tokenFor(userId)}`
        },
        body: JSON.stringify({ text, ...extraFields })
    };
}

function mockedBrainDumpService(generateContent) {
    const geminiService = createGeminiService({
        configProvider: () => ({ apiKey: "test-api-key", model: "gemini-test-model" }),
        clientFactory: () => ({
            models: { generateContent }
        })
    });

    return createBrainDumpService({ aiService: geminiService });
}

test("Brain Dump processing returns validated summary and proposed tasks without saving", async () => {
    let prompt;
    const service = mockedBrainDumpService(async (request) => {
        prompt = request.contents;
        return {
            text: JSON.stringify({
                summary: "Prepare for the biology exam.",
                tasks: [
                    {
                        title: "Review cell structure",
                        description: "Use the class notes.",
                        priority: "HIGH",
                        dueDate: "2026-12-01"
                    },
                    {
                        title: "Make flashcards",
                        priority: "MEDIUM"
                    }
                ]
            })
        };
    });

    await withServer(service, async (request) => {
        const response = await request(
            "/api/brain-dumps/process",
            brainDumpRequest("Biology exam next week; review cell structure and make flashcards.")
        );

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            summary: "Prepare for the biology exam.",
            tasks: [
                {
                    title: "Review cell structure",
                    priority: "HIGH",
                    description: "Use the class notes.",
                    dueDate: "2026-12-01"
                },
                {
                    title: "Make flashcards",
                    priority: "MEDIUM"
                }
            ]
        });
        assert.match(prompt, /Biology exam next week/);
        assert.doesNotMatch(prompt, new RegExp(USER_A));
    });
});

test("Brain Dump endpoint requires authentication", async () => {
    let calls = 0;
    const service = mockedBrainDumpService(async () => {
        calls += 1;
        return { text: "{}" };
    });

    await withServer(service, async (request) => {
        const missing = await request("/api/brain-dumps/process", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: "Some notes" })
        });
        const invalid = await request("/api/brain-dumps/process", {
            ...brainDumpRequest("Some notes"),
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

test("Brain Dump endpoint validates input and rejects user-supplied IDs", async () => {
    let calls = 0;
    const service = mockedBrainDumpService(async () => {
        calls += 1;
        return {
            text: JSON.stringify({ summary: "Summary", tasks: [] })
        };
    });

    await withServer(service, async (request) => {
        const invalidBodies = [
            null,
            [],
            {},
            { text: "" },
            { text: "   " },
            { text: 10 },
            { text: "x".repeat(8001) },
            { text: "Some notes", userId: USER_B }
        ];

        for (const body of invalidBodies) {
            const response = await request("/api/brain-dumps/process", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${tokenFor()}`
                },
                body: JSON.stringify(body)
            });
            assert.equal(response.status, 400);
        }

        const maxLength = await request(
            "/api/brain-dumps/process",
            brainDumpRequest("x".repeat(8000))
        );
        assert.equal(maxLength.status, 200);
        assert.equal(calls, 1);
    });
});

test("Brain Dump endpoint rejects malformed and invalid generated output safely", async () => {
    const invalidOutputs = [
        "not JSON",
        JSON.stringify({ summary: "", tasks: [] }),
        JSON.stringify({ summary: "Summary", tasks: {}, private: "extra" }),
        JSON.stringify({ summary: "Summary", tasks: [{ title: "Task", priority: "URGENT" }] }),
        JSON.stringify({ summary: "Summary", tasks: [{ title: "Task", priority: "LOW", dueDate: "2026-02-31" }] }),
        JSON.stringify({ summary: "Summary", tasks: [{ title: "Task", priority: "LOW", userId: USER_A }] })
    ];

    for (const output of invalidOutputs) {
        const service = mockedBrainDumpService(async () => ({ text: output }));

        await withServer(service, async (request) => {
            const response = await request(
                "/api/brain-dumps/process",
                brainDumpRequest("Some notes")
            );
            assert.equal(response.status, 502);
            assert.deepEqual(await response.json(), { error: "AI returned an invalid response" });
        });
    }
});

test("Brain Dump endpoint handles provider failures and timeouts safely", async () => {
    const failures = [
        {
            code: "provider",
            status: 502,
            body: { error: "AI service is temporarily unavailable" }
        },
        {
            code: "timeout",
            status: 504,
            body: { error: "AI response timed out" }
        },
        {
            code: "configuration",
            status: 503,
            body: { error: "AI service is not configured" }
        },
        {
            code: "rate_limit",
            status: 429,
            body: { error: "AI service rate limit reached. Please try again later." }
        }
    ];

    for (const failure of failures) {
        const geminiService = {
            generateContent: async () => {
                throw new GeminiServiceError("Sensitive provider detail", failure.code);
            }
        };
        const service = createBrainDumpService({ aiService: geminiService });

        await withServer(service, async (request) => {
            const response = await request(
                "/api/brain-dumps/process",
                brainDumpRequest("Some notes")
            );
            assert.equal(response.status, failure.status);
            assert.deepEqual(await response.json(), failure.body);
        });
    }
});

test("Brain Dump endpoint rate limits requests per authenticated user", async () => {
    let calls = 0;
    const service = mockedBrainDumpService(async () => {
        calls += 1;
        return { text: JSON.stringify({ summary: "Summary", tasks: [] }) };
    });

    await withServer(service, async (request) => {
        const userAResponses = [];
        for (let attempt = 0; attempt < 6; attempt += 1) {
            userAResponses.push(await request(
                "/api/brain-dumps/process",
                brainDumpRequest("Notes", USER_A)
            ));
        }

        const userBResponse = await request(
            "/api/brain-dumps/process",
            brainDumpRequest("Notes", USER_B)
        );

        assert.equal(userAResponses.slice(0, 5).every((response) => response.status === 200), true);
        assert.equal(userAResponses[5].status, 429);
        assert.equal(userBResponse.status, 200);
        assert.equal(calls, 6);
    });
});
