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
    const originalTokenTtl = process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES;
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = "45";
    t.after(() => {
        if (originalTokenTtl === undefined) {
            delete process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES;
        } else {
            process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = originalTokenTtl;
        }
    });
    let createdReset = null;
    let resetUsed = false;
    let userLookups = 0;
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
            findUnique: async ({ where }) => {
                userLookups += 1;
                return where.email === user.email ? user : null;
            },
            update: async () => user
        },
        passwordResetToken: {
            updateMany: async () => ({ count: 1 }),
            create: async ({ data }) => {
                createdReset = data;
                return data;
            },
            findFirst: async ({ where }) => createdReset && !resetUsed &&
                where.tokenHash === createdReset.tokenHash &&
                createdReset.expiresAt > where.expiresAt.gt ? {
                id: "22222222-2222-4222-8222-222222222222",
                userId: user.id,
                usedAt: null,
                expiresAt: createdReset.expiresAt,
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

    const invalidEmail = await fetch(`${started.baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" })
    });
    assert.equal(invalidEmail.status, 400);
    assert.equal(userLookups, 0);

    const unknown = await fetch(`${started.baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "unknown@example.com" })
    });
    assert.equal(unknown.status, 202);

    const resetRequestedAt = Date.now();
    const known = await fetch(`${started.baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email })
    });
    assert.equal(known.status, 202);
    assert.ok(createdReset);
    const ttlMs = 45 * 60 * 1000;
    assert.ok(createdReset.expiresAt.getTime() >= resetRequestedAt + ttlMs - 1000);
    assert.ok(createdReset.expiresAt.getTime() <= resetRequestedAt + ttlMs + 5000);
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

test("expired password reset tokens are rejected before claiming or changing a password", async (t) => {
    let tokenLookupWhere;
    let transactionCalls = 0;
    const prisma = {
        passwordResetToken: {
            findFirst: async ({ where }) => {
                tokenLookupWhere = where;
                const expiredAt = new Date(Date.now() - 1000);
                return expiredAt > where.expiresAt.gt ? { expiresAt: expiredAt } : null;
            }
        },
        $transaction: async () => {
            transactionCalls += 1;
            throw new Error("An expired token must not start a transaction");
        }
    };
    const started = await listen(prisma, { sendResetLink: async () => ({ delivered: true }) });
    t.after(() => started.server.close());

    const response = await fetch(`${started.baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            token: "a".repeat(64),
            password: "NewPassword123!"
        })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Reset token is invalid or expired" });
    assert.ok(tokenLookupWhere.expiresAt.gt instanceof Date);
    assert.equal(transactionCalls, 0);
});
