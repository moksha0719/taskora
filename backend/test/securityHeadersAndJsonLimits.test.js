const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const test = require("node:test");
const createApp = require("../src/app");
const logSafeError = require("../src/lib/logSafeError");

async function withServer(run) {
    const server = createApp().listen(0);
    await once(server, "listening");
    const address = server.address();
    const request = (path, options = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, options);

    try {
        await run(request, address.port);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

function sendChunkedRequest(port, headers) {
    return new Promise((resolve, reject) => {
        const request = http.request({
            hostname: "127.0.0.1",
            port,
            path: "/api/auth/login",
            method: "POST",
            headers
        }, (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => { body += chunk; });
            response.on("end", () => {
                resolve({ status: response.statusCode, body: JSON.parse(body) });
            });
        });

        request.on("error", reject);
        request.write("not-json");
        request.end();
    });
}

test("JSON parsing errors, oversized payloads, and API security headers are handled safely", async () => {
    await withServer(async (request, port) => {
        const validJson = await request("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "not-an-email", password: "invalid" })
        });
        assert.equal(validJson.status, 400);
        assert.deepEqual(await validJson.json(), { error: "A valid email is required" });

        const malformed = await request("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: '{"email":'
        });
        assert.equal(malformed.status, 400);
        assert.deepEqual(await malformed.json(), { error: "Invalid JSON payload" });

        const unsupported = await request("/api/auth/login", {
            method: "POST",
            headers: {
                authorization: "Bearer test-token",
                "content-type": "text/plain"
            },
            body: "not-json"
        });
        assert.equal(unsupported.status, 415);
        assert.deepEqual(await unsupported.json(), { error: "Unsupported content type" });

        const chunkedUnsupported = await sendChunkedRequest(port, {
            authorization: "Bearer test-token",
            "content-type": "text/plain"
        });
        assert.deepEqual(chunkedUnsupported, {
            status: 415,
            body: { error: "Unsupported content type" }
        });

        const chunkedWithoutContentType = await sendChunkedRequest(port, {
            authorization: "Bearer test-token"
        });
        assert.deepEqual(chunkedWithoutContentType, {
            status: 415,
            body: { error: "Unsupported content type" }
        });

        const oversized = await request("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ value: "x".repeat(2_000_000) })
        });
        assert.equal(oversized.status, 413);
        assert.deepEqual(await oversized.json(), {
            error: "Request body exceeds the supported size limit"
        });

        const health = await request("/health/live");
        assert.equal(health.headers.get("x-powered-by"), null);
        assert.equal(health.headers.get("x-content-type-options"), "nosniff");
        assert.equal(health.headers.get("x-frame-options"), "DENY");
        assert.equal(health.headers.get("referrer-policy"), "no-referrer");
        assert.equal(health.headers.get("permissions-policy"), "geolocation=(), microphone=(), camera=()");
    });
});

test("safe error logging omits exception messages and only records diagnostic identifiers", () => {
    const calls = [];
    const originalConsoleError = console.error;
    console.error = (...args) => calls.push(args);

    try {
        logSafeError("Request failed:", {
            name: "PrismaClientKnownRequestError",
            code: "P1000",
            message: "Sensitive connection details"
        });
    } finally {
        console.error = originalConsoleError;
    }

    assert.deepEqual(calls, [[
        "Request failed:",
        { name: "PrismaClientKnownRequestError", code: "P1000" }
    ]]);
});
