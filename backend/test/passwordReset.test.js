"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const express = require("express");
const { once } = require("node:events");
const createAuthRouter = require("../src/routes/authRoutes");

async function listen(prisma, passwordResetDelivery) {
    const app = express();
    app.use(express.json());
    app.use("/api/auth", createAuthRouter(prisma, passwordResetDelivery));
    app.use((error, req, res, next) => res.status(500).json({ error: "Internal server error" }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

test("password recovery uses opaque single-use reset tokens", async (t) => {
    process.env.JWT_SECRET = "taskora-password-reset-test-secret-at-least-32";
    let createdReset = null;
    let resetUsed = false;
    const deliveries = [];
    const user = {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Student",
        email: "student@example.com",
        password: "not-a-real-password-hash",
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const prisma = {
        user: {
            findUnique: async ({ where }) => where.email === user.email ? user : null,
            update: async () => user
        },
        passwordResetToken: {
            updateMany: async () => ({ count: 1 }),
            create: async ({ data }) => {
                createdReset = data;
                return data;
            },
            findFirst: async ({ where }) => createdReset && !resetUsed &&
                where.tokenHash === createdReset.tokenHash ? {
                id: "22222222-2222-4222-8222-222222222222",
                userId: user.id,
                usedAt: null,
                expiresAt: new Date(Date.now() + 60000),
                user
            } : null
        },
        $transaction: async (callback) => callback({
            passwordResetToken: { updateMany: async () => {
                if (resetUsed) return { count: 0 };
                resetUsed = true;
                return { count: 1 };
            } },
            user: { update: async () => user }
        })
    };
    const started = await listen(prisma, {
        sendResetLink: async (delivery) => {
            deliveries.push(delivery);
            return { delivered: true };
        }
    });
    t.after(() => started.server.close());

    const unknown = await fetch(`${started.baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "unknown@example.com" })
    });
    assert.equal(unknown.status, 202);

    const known = await fetch(`${started.baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email })
    });
    assert.equal(known.status, 202);
    assert.ok(createdReset);
    assert.match(createdReset.tokenHash, /^[a-f0-9]{64}$/);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].email, user.email);
    assert.match(deliveries[0].token, /^[a-f0-9]{64}$/);
    assert.equal(
        createdReset.tokenHash,
        crypto.createHash("sha256").update(deliveries[0].token).digest("hex")
    );

    const concurrent = await Promise.all([
        fetch(`${started.baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: deliveries[0].token, password: "NewPassword123!" })
        }),
        fetch(`${started.baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: deliveries[0].token, password: "AnotherPassword123!" })
        })
    ]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 400]);

    const reuse = await fetch(`${started.baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: deliveries[0].token, password: "AnotherPassword123!" })
    });
    assert.equal(reuse.status, 400);
});
