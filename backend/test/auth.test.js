const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");

const TEST_SECRET = "test-only-jwt-secret-with-at-least-32-bytes";
process.env.JWT_SECRET = TEST_SECRET;

function createPrismaMock(initialUser = null) {
    let user = initialUser;
    const selectFields = (record, select) => Object.fromEntries(
        Object.keys(select).map((field) => [field, record[field]])
    );

    return {
        storedUser: () => user,
        user: {
            create: async ({ data, select }) => {
                if (user && user.email === data.email) {
                    const error = new Error("Unique constraint failed");
                    error.code = "P2002";
                    throw error;
                }

                user = {
                    id: "test-user-id",
                    ...data,
                    createdAt: new Date("2026-01-01T00:00:00.000Z"),
                    updatedAt: new Date("2026-01-01T00:00:00.000Z")
                };
                return selectFields(user, select);
            },
            findUnique: async ({ where, select }) => {
                if (!user) {
                    return null;
                }

                if ((where.email && where.email === user.email) ||
                    (where.id && where.id === user.id)) {
                    return selectFields(user, select);
                }

                return null;
            }
        }
    };
}

async function withServer(prisma, run) {
    const server = createApp({ prismaClient: prisma }).listen(0);
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

function jsonRequest(body, headers = {}) {
    return {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body)
    };
}

test("registration normalizes email and hashes the password without exposing account existence", async () => {
    const prisma = createPrismaMock();

    await withServer(prisma, async (request) => {
        const response = await request("/api/auth/register", jsonRequest({
            name: "  Alex Doe  ",
            email: "  Alex@Example.com ",
            password: "a-secure-password"
        }));
        const body = await response.json();

        assert.equal(response.status, 202);
        assert.deepEqual(body, { message: "If registration can be completed, you can now sign in." });
        assert.equal("password" in prisma.storedUser(), true);
        assert.notEqual(prisma.storedUser().password, "a-secure-password");
        assert.equal(await bcrypt.compare("a-secure-password", prisma.storedUser().password), true);
    });
});

test("registration rejects duplicate email addresses", async () => {
    const prisma = createPrismaMock();
    const registration = jsonRequest({
        name: "Alex Doe",
        email: "alex@example.com",
        password: "a-secure-password"
    });

    await withServer(prisma, async (request) => {
        const firstResponse = await request("/api/auth/register", registration);
        const duplicate = await request("/api/auth/register", registration);
        assert.equal(firstResponse.status, 202);
        assert.equal(duplicate.status, 202);
        assert.deepEqual(await duplicate.json(), await firstResponse.json());
    });
});

test("registration validates required fields and password length", async () => {
    await withServer(createPrismaMock(), async (request) => {
        const missingName = await request("/api/auth/register", jsonRequest({
            email: "alex@example.com",
            password: "a-secure-password"
        }));
        const shortPassword = await request("/api/auth/register", jsonRequest({
            name: "Alex",
            email: "alex@example.com",
            password: "short"
        }));

        assert.equal(missingName.status, 400);
        assert.equal(shortPassword.status, 400);
    });
});

test("login returns a JWT that authenticates the safe /me endpoint", async () => {
    const passwordHash = await bcrypt.hash("a-secure-password", 4);
    const prisma = createPrismaMock({
        id: "test-user-id",
        name: "Alex Doe",
        email: "alex@example.com",
        password: passwordHash,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    await withServer(prisma, async (request) => {
        const response = await request("/api/auth/login", jsonRequest({
            email: " ALEX@EXAMPLE.COM ",
            password: "a-secure-password"
        }));
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(typeof body.token, "string");
        assert.equal("password" in body.user, false);
        const profileResponse = await request("/api/auth/me", {
            headers: { authorization: `Bearer ${body.token}` }
        });
        const profile = await profileResponse.json();

        assert.equal(profileResponse.status, 200);
        assert.equal(profile.user.id, "test-user-id");
        assert.equal("password" in profile.user, false);
    });
});

test("login returns the same generic error for unknown users and wrong passwords", async () => {
    const passwordHash = await bcrypt.hash("a-secure-password", 4);
    const prisma = createPrismaMock({
        id: "test-user-id",
        name: "Alex Doe",
        email: "alex@example.com",
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await withServer(prisma, async (request) => {
        const wrongPassword = await request("/api/auth/login", jsonRequest({
            email: "alex@example.com",
            password: "a-different-password"
        }));
        const unknownUser = await request("/api/auth/login", jsonRequest({
            email: "nobody@example.com",
            password: "a-secure-password"
        }));

        assert.equal(wrongPassword.status, 401);
        assert.deepEqual(await wrongPassword.json(), await unknownUser.json());
    });
});

test("protected /me rejects missing, invalid, and expired JWTs", async () => {
    await withServer(createPrismaMock(), async (request) => {
        const expiredToken = jwt.sign({}, TEST_SECRET, {
            algorithm: "HS256",
            audience: JWT_AUDIENCE,
            expiresIn: -1,
            issuer: JWT_ISSUER,
            subject: "test-user-id"
        });

        const responses = await Promise.all([
            request("/api/auth/me"),
            request("/api/auth/me", { headers: { authorization: "Bearer not-a-token" } }),
            request("/api/auth/me", { headers: { authorization: `Bearer ${expiredToken}` } })
        ]);

        assert.deepEqual(responses.map((response) => response.status), [401, 401, 401]);
    });
});

test("authentication routes apply a shared request limit", async () => {
    await withServer(createPrismaMock(), async (request) => {
        const responses = [];
        for (let attempt = 0; attempt < 11; attempt += 1) {
            responses.push(await request("/api/auth/login", jsonRequest({})));
        }

        assert.equal(responses.slice(0, 10).every((response) => response.status === 400), true);
        assert.equal(responses[10].status, 429);
    });
});
