const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const createApp = require("../src/app");

async function withServer(prismaClient, run, env = { NODE_ENV: "test" }) {
    const app = createApp({
        prismaClient,
        notificationService: { createNotification: async () => ({}) },
        env
    });
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const request = (path, options) =>
        fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
    try {
        await run(request);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

test("liveness endpoint does not require the database and readiness checks the database", async () => {
    let queries = 0;
    await withServer({
        $queryRaw: async (strings) => {
            queries += 1;
            assert.equal(strings[0], "SELECT 1");
            return [{ "?column?": 1 }];
        }
    }, async (request) => {
        const liveResponse = await request("/health/live");
        assert.equal(liveResponse.status, 200);
        assert.deepEqual(await liveResponse.json(), { status: "ok" });
        assert.equal(queries, 0);

        const readyResponse = await request("/health/ready");
        assert.equal(readyResponse.status, 200);
        assert.deepEqual(await readyResponse.json(), { status: "ready" });
        assert.equal(queries, 1);
    });
});

test("readiness returns a safe 503 response when the database is unavailable", async () => {
    await withServer({
        $queryRaw: async () => {
            const error = new Error("sensitive database connection detail");
            error.name = "PrismaClientInitializationError";
            throw error;
        }
    }, async (request) => {
        const response = await request("/health/ready");
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: "not_ready" });
    });
});

test("production CORS allows configured origins and rejects unapproved origins", async () => {
    await withServer({
        $queryRaw: async () => [{ "?column?": 1 }]
    }, async (request) => {
        const allowed = await request("/health/live", {
            headers: { Origin: "https://frontend.example.test" }
        });
        assert.equal(allowed.status, 200);
        assert.equal(
            allowed.headers.get("access-control-allow-origin"),
            "https://frontend.example.test"
        );

        const rejected = await request("/health/live", {
            headers: { Origin: "https://other.example.test" }
        });
        assert.equal(rejected.status, 403);
        assert.deepEqual(await rejected.json(), { error: "Origin not allowed" });
    }, {
        NODE_ENV: "production",
        CORS_ALLOWED_ORIGINS: "https://frontend.example.test"
    });
});

test("production CORS rejects origins when no allowlist is configured", async () => {
    await withServer({
        $queryRaw: async () => [{ "?column?": 1 }]
    }, async (request) => {
        const serverRequest = await request("/health/live");
        assert.equal(serverRequest.status, 200);

        const browserRequest = await request("/health/live", {
            headers: { Origin: "https://frontend.example.test" }
        });
        assert.equal(browserRequest.status, 403);
        assert.deepEqual(await browserRequest.json(), { error: "Origin not allowed" });
    }, { NODE_ENV: "production" });
});

test("development CORS remains permissive when no allowlist is configured", async () => {
    await withServer({
        $queryRaw: async () => [{ "?column?": 1 }]
    }, async (request) => {
        const response = await request("/health/live", {
            headers: { Origin: "http://localhost:5173" }
        });
        assert.equal(response.status, 200);
        assert.equal(
            response.headers.get("access-control-allow-origin"),
            "http://localhost:5173"
        );
    }, { NODE_ENV: "development" });
});
