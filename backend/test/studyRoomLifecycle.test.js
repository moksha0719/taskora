"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");
const createProductRouter = require("../src/routes/productRoutes");
const { JWT_ISSUER, JWT_AUDIENCE } = require("../src/config/auth");

async function listen(prisma, clock) {
    const app = express();
    app.use(express.json());
    app.use("/api", createProductRouter(prisma, { now: () => new Date(clock.value) }));
    app.use((error, req, res, next) => res.status(500).json({ error: "Internal server error" }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

function authHeader(userId) {
    const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        subject: userId,
        expiresIn: "1h"
    });
    return { Authorization: `Bearer ${token}` };
}

test("study room lifecycle restricts management to owners and persists shared timer state", async (t) => {
    process.env.JWT_SECRET = "taskora-study-room-test-secret-at-least-32";
    const ownerId = "11111111-1111-4111-8111-111111111111";
    const memberId = "22222222-2222-4222-8222-222222222222";
    const room = {
        id: "33333333-3333-4333-8333-333333333333",
        ownerId,
        name: "Study room",
        topic: "Revision",
        maxParticipants: 8,
        focusDurationMinutes: 5,
        breakDurationMinutes: 1,
        currentMode: "FOCUS",
        timerRemainingSeconds: 300,
        timerStartedAt: null
    };
    const deletedParticipants = [];
    const prisma = {
        studyRoom: {
            findUnique: async ({ where }) => where.id === room.id ? { ...room } : null,
            update: async ({ where, data }) => {
                assert.equal(where.id, room.id);
                Object.assign(room, data);
                return { ...room };
            },
            deleteMany: async ({ where }) => {
                assert.equal(where.ownerId, ownerId);
                return { count: where.id === room.id ? 1 : 0 };
            }
        },
        roomParticipant: {
            count: async () => 1,
            deleteMany: async ({ where }) => {
                deletedParticipants.push(where);
                return { count: where.userId === memberId ? 1 : 0 };
            }
        }
    };
    const clock = { value: new Date("2026-11-20T08:00:00.000Z") };
    const server = await listen(prisma, clock);
    t.after(() => server.server.close());

    const unauthorizedEdit = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}`, {
        method: "PATCH",
        headers: { ...authHeader(memberId), "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Changed" })
    });
    assert.equal(unauthorizedEdit.status, 404);
    assert.equal(room.name, "Study room");

    const edit = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}`, {
        method: "PATCH",
        headers: { ...authHeader(ownerId), "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated room", maxParticipants: 10 })
    });
    assert.equal(edit.status, 200);
    assert.equal(room.name, "Updated room");
    assert.equal(room.maxParticipants, 10);

    const start = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}/timer`, {
        method: "PATCH",
        headers: { ...authHeader(ownerId), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" })
    });
    assert.equal(start.status, 200);
    assert.equal(room.timerStartedAt.toISOString(), "2026-11-20T08:00:00.000Z");

    clock.value = new Date("2026-11-20T08:00:30.000Z");
    const pause = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}/timer`, {
        method: "PATCH",
        headers: { ...authHeader(ownerId), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" })
    });
    assert.equal(pause.status, 200);
    assert.equal(room.timerRemainingSeconds, 270);
    assert.equal(room.timerStartedAt, null);

    const next = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}/timer`, {
        method: "PATCH",
        headers: { ...authHeader(ownerId), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next" })
    });
    assert.equal(next.status, 200);
    assert.equal(room.currentMode, "BREAK");
    assert.equal(room.timerRemainingSeconds, 60);

    const memberTimerAction = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}/timer`, {
        method: "PATCH",
        headers: { ...authHeader(memberId), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" })
    });
    assert.equal(memberTimerAction.status, 404);

    const memberLeave = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}/participants/me`, {
        method: "DELETE",
        headers: authHeader(memberId)
    });
    assert.equal(memberLeave.status, 204);
    assert.deepEqual(deletedParticipants[0], { roomId: room.id, userId: memberId });

    const ownerLeave = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}/participants/me`, {
        method: "DELETE",
        headers: authHeader(ownerId)
    });
    assert.equal(ownerLeave.status, 409);

    const ownerDelete = await fetch(`${server.baseUrl}/api/study-rooms/${room.id}`, {
        method: "DELETE",
        headers: authHeader(ownerId)
    });
    assert.equal(ownerDelete.status, 204);
});
