"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");
const createProductRouter = require("../src/routes/productRoutes");
const { JWT_ISSUER, JWT_AUDIENCE } = require("../src/config/auth");

function listen(prisma, routerOptions) {
    const app = express();
    app.use(express.json());
    app.use("/api", createProductRouter(prisma, routerOptions));
    app.use((error, req, res, next) => res.status(500).json({ error: "Internal server error" }));
    const server = app.listen(0, "127.0.0.1");
    return once(server, "listening").then(() => ({
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`
    }));
}

test("product routes enforce authentication and persist owner-scoped habits and notes", async (t) => {
    const userId = "11111111-1111-4111-8111-111111111111";
    process.env.JWT_SECRET = "taskora-product-route-test-secret-at-least-32";
    const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        subject: userId,
        expiresIn: "1h"
    });
    const otherUserToken = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        subject: "22222222-2222-4222-8222-222222222222",
        expiresIn: "1h"
    });
    const storedNotes = new Map();
    const storedFocusSessions = [];
    const focusXpTransactions = [];
    const focusSessionAggregates = [];
    const clock = { value: new Date("2026-11-20T08:00:00.000Z") };
    const focusSessionModel = {
        findUnique: async (args) => {
            const session = storedFocusSessions.find((item) =>
                item.completionKey === args.where.completionKey
            );
            return session
                ? Object.fromEntries(Object.keys(args.select).map((field) => [field, session[field]]))
                : null;
        },
        findMany: async (args) => storedFocusSessions.map((session) =>
            Object.fromEntries(Object.keys(args.select).map((field) => [field, session[field]]))
        ),
        findFirst: async (args) => {
            const latest = storedFocusSessions
                .slice()
                .sort((left, right) => right.completedAt - left.completedAt)[0];
            return latest
                ? Object.fromEntries(Object.keys(args.select).map((field) => [field, latest[field]]))
                : null;
        },
        aggregate: async (args) => {
            focusSessionAggregates.push(args);
            return {
                _sum: {
                    durationMinutes: focusSessionAggregates.length === 1 ? 45 : null
                }
            };
        },
        create: async (args) => {
            const session = {
                id: `55555555-5555-4555-8555-${String(storedFocusSessions.length + 1).padStart(12, "0")}`,
                ...args.data
            };
            storedFocusSessions.push(session);
            return Object.fromEntries(Object.keys(args.select).map((field) => [field, session[field]]));
        }
    };
    const prisma = {
        habit: {
            findMany: async (args) => { assert.equal(args.where.userId, userId); return []; },
            create: async (args) => ({ id: "22222222-2222-4222-8222-222222222222", ...args.data }),
            findFirst: async (args) => args.where.userId === userId
                ? { id: args.where.id, userId }
                : null,
            deleteMany: async () => ({ count: 0 })
        },
        habitCheckIn: {
            upsert: async (args) => args.create,
            deleteMany: async () => ({ count: 1 })
        },
        studyNote: {
            findMany: async (args) => { assert.equal(args.where.userId, userId); return []; },
            create: async (args) => {
                const note = { id: `33333333-3333-4333-8333-${String(storedNotes.size + 1).padStart(12, "0")}`, ...args.data };
                storedNotes.set(note.id, note);
                return note;
            },
            findFirst: async (args) => {
                const note = args.where.userId === userId
                    ? storedNotes.get(args.where.id)
                    : [...storedNotes.values()].find((stored) =>
                        stored.shareCode === args.where.shareCode && stored.isPrivate === false
                    );
                if (!note) return null;
                return args.select
                    ? Object.fromEntries(Object.keys(args.select).map((field) => [field, note[field]]))
                    : note;
            },
            findUnique: async () => null,
            update: async (args) => {
                const note = { ...storedNotes.get(args.where.id), ...args.data };
                storedNotes.set(note.id, note);
                return note;
            },
            deleteMany: async () => ({ count: 0 })
        },
        user: {
            findUnique: async () => ({ role: "STUDENT" }),
            count: async () => 1
        },
        moderationReport: {
            findFirst: async () => null,
            create: async (args) => ({ id: "66666666-6666-4666-8666-666666666666", ...args.data }),
            findUnique: async () => null,
            findMany: async () => [],
            updateMany: async () => ({ count: 0 }),
            count: async () => 0
        },
        auditLog: { create: async (args) => args.data, findMany: async () => [] },
        focusSession: focusSessionModel,
        studyRoom: {
            findMany: async (args) => {
                assert.deepEqual(args.where, { isPrivate: false });
                assert.deepEqual(args.include.participants.include.user.select, {
                    id: true,
                    name: true,
                    avatar: true
                });
                assert.deepEqual(args.include.messages.include.user.select, {
                    id: true,
                    name: true,
                    avatar: true
                });
                return [{
                    id: "44444444-4444-4444-8444-444444444444",
                    ownerId: userId,
                    name: "Public room",
                    topic: "Revision",
                    isPrivate: false,
                    inviteCode: null,
                    passcodeHash: null,
                    participants: [{
                        id: "participant-id",
                        userId,
                        status: "focusing",
                        joinedAt: new Date("2026-11-20T08:00:00.000Z"),
                        email: "private-participant@example.invalid",
                        user: {
                            id: userId,
                            name: "Study owner",
                            avatar: null,
                            email: "private-user@example.invalid",
                            password: "test-only-password-hash"
                        }
                    }],
                    messages: [{
                        id: "55555555-5555-4555-8555-555555555555",
                        userId,
                        user: { id: userId, name: "Study owner", avatar: null },
                        content: "Ready to study"
                    }]
                }];
            },
            findUnique: async () => null,
            create: async (args) => {
                if (args.data.isPrivate) {
                    assert.match(args.data.inviteCode, /^[0-9a-f]{8}$/);
                } else {
                    assert.equal(args.data.inviteCode, null);
                }
                assert.deepEqual(args.include.participants.include.user.select, {
                    id: true,
                    name: true,
                    avatar: true
                });
                return {
                    id: "44444444-4444-4444-8444-444444444445",
                    ...args.data,
                    participants: [{
                        userId,
                        status: "focusing",
                        joinedAt: new Date("2026-11-20T08:00:00.000Z"),
                        user: { id: userId, name: "Study owner", avatar: null }
                    }],
                    messages: []
                };
            }
        },
        roomParticipant: { findUnique: async () => null, upsert: async (args) => args.create },
        roomMessage: { create: async (args) => args.data },
        xPTransaction: { findMany: async () => [], create: async (args) => args.data },
        userAchievement: { findMany: async () => [] },
        task: { findMany: async () => [], count: async () => 0 },
        $transaction: async (callback) => callback({
            focusSession: focusSessionModel,
            xPTransaction: {
                createMany: async (args) => {
                    focusXpTransactions.push(...args.data);
                    return { count: args.data.length };
                }
            }
        })
    };
    const started = await listen(prisma, { now: () => new Date(clock.value) });
    t.after(() => started.server.close());

    const unauthorized = await fetch(`${started.baseUrl}/api/habits`);
    assert.equal(unauthorized.status, 401);

    const habits = await fetch(`${started.baseUrl}/api/habits`, {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(habits.status, 200);
    assert.deepEqual((await habits.json()).habits, []);

    const unauthenticatedTodayFocus = await fetch(`${started.baseUrl}/api/focus-sessions/today`);
    assert.equal(unauthenticatedTodayFocus.status, 401);

    const todayFocus = await fetch(
        `${started.baseUrl}/api/focus-sessions/today?timeZone=Asia%2FColombo`,
        { headers: { authorization: `Bearer ${token}` } }
    );
    assert.equal(todayFocus.status, 200);
    assert.deepEqual(await todayFocus.json(), {
        date: "2026-11-20",
        timeZone: "Asia/Colombo",
        totalFocusMinutes: 45
    });
    assert.deepEqual(focusSessionAggregates[0].where, {
        userId,
        completedAt: {
            gte: new Date("2026-11-19T18:30:00.000Z"),
            lt: new Date("2026-11-20T18:30:00.000Z")
        }
    });

    const todayFocusUtc = await fetch(`${started.baseUrl}/api/focus-sessions/today`, {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(todayFocusUtc.status, 200);
    assert.deepEqual(await todayFocusUtc.json(), {
        date: "2026-11-20",
        timeZone: "UTC",
        totalFocusMinutes: 0
    });
    assert.deepEqual(focusSessionAggregates[1].where.completedAt, {
        gte: new Date("2026-11-20T00:00:00.000Z"),
        lt: new Date("2026-11-21T00:00:00.000Z")
    });

    const invalidTimeZone = await fetch(
        `${started.baseUrl}/api/focus-sessions/today?timeZone=Mars%2FOlympus`,
        { headers: { authorization: `Bearer ${token}` } }
    );
    assert.equal(invalidTimeZone.status, 400);

    const createdHabit = await fetch(`${started.baseUrl}/api/habits`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ title: "Read", category: "Study" })
    });
    assert.equal(createdHabit.status, 201);
    assert.equal((await createdHabit.json()).habit.title, "Read");

    const invalidHabitDate = await fetch(
        `${started.baseUrl}/api/habits/22222222-2222-4222-8222-222222222222/check-ins`,
        {
            method: "PUT",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify({ date: "2026-02-31", checked: true })
        }
    );
    assert.equal(invalidHabitDate.status, 400);

    const checkedHabit = await fetch(
        `${started.baseUrl}/api/habits/22222222-2222-4222-8222-222222222222/check-ins`,
        {
            method: "PUT",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify({ date: "2026-02-28", checked: true })
        }
    );
    assert.equal(checkedHabit.status, 200);
    assert.deepEqual(await checkedHabit.json(), { checked: true });

    const notes = await fetch(`${started.baseUrl}/api/notes`, {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(notes.status, 200);
    assert.deepEqual((await notes.json()).notes, []);

    const sharedNoteResponse = await fetch(`${started.baseUrl}/api/notes`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ title: "Shared", content: "Public note", isPrivate: false })
    });
    assert.equal(sharedNoteResponse.status, 201);
    const sharedNote = (await sharedNoteResponse.json()).note;
    assert.match(sharedNote.shareCode, /^[a-f0-9]{32}$/);

    const publicNoteResponse = await fetch(
        `${started.baseUrl}/api/notes/shared/${sharedNote.shareCode}`
    );
    assert.equal(publicNoteResponse.status, 200);
    assert.deepEqual((await publicNoteResponse.json()).note, {
        id: sharedNote.id,
        title: "Shared",
        content: "Public note",
        subjectName: null,
        tags: []
    });

    const privateNoteResponse = await fetch(`${started.baseUrl}/api/notes`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ title: "Private", content: "Private note" })
    });
    const privateNote = (await privateNoteResponse.json()).note;
    const privateLinkResponse = await fetch(
        `${started.baseUrl}/api/notes/shared/${privateNote.shareCode || "a".repeat(32)}`
    );
    assert.equal(privateLinkResponse.status, 404);

    const listedRoomsResponse = await fetch(`${started.baseUrl}/api/study-rooms`, {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(listedRoomsResponse.status, 200);
    const listedRoom = (await listedRoomsResponse.json()).rooms[0];
    assert.equal(listedRoom.isPrivate, false);
    assert.equal(Object.hasOwn(listedRoom, "passcodeHash"), false);
    assert.equal(listedRoom.participants[0].user.name, "Study owner");
    assert.deepEqual(Object.keys(listedRoom.participants[0].user).sort(), ["avatar", "id", "name"]);
    assert.equal(Object.hasOwn(listedRoom.participants[0], "email"), false);
    assert.equal(Object.hasOwn(listedRoom.participants[0].user, "email"), false);
    assert.equal(Object.hasOwn(listedRoom.participants[0].user, "password"), false);
    assert.equal(listedRoom.messages[0].user.name, "Study owner");

    const focusStartResponse = await fetch(`${started.baseUrl}/api/focus/sessions/start`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ subject: "Discrete Mathematics", durationMinutes: 1 })
    });
    assert.equal(focusStartResponse.status, 201);
    const focusToken = (await focusStartResponse.json()).sessionToken;
    const overlappingStartResponse = await fetch(`${started.baseUrl}/api/focus/sessions/start`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ subject: "Discrete Mathematics", durationMinutes: 1 })
    });
    const overlappingToken = (await overlappingStartResponse.json()).sessionToken;

    const prematureFocusCompletion = await fetch(`${started.baseUrl}/api/focus/sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ sessionToken: focusToken })
    });
    assert.equal(prematureFocusCompletion.status, 409);

    const otherUserFocusCompletion = await fetch(`${started.baseUrl}/api/focus/sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${otherUserToken}`, "content-type": "application/json" },
        body: JSON.stringify({ sessionToken: focusToken })
    });
    assert.equal(otherUserFocusCompletion.status, 400);

    const signatureParts = focusToken.split(".");
    signatureParts[1] = `${signatureParts[1][0] === "a" ? "b" : "a"}${signatureParts[1].slice(1)}`;
    const tamperedFocusCompletion = await fetch(`${started.baseUrl}/api/focus/sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ sessionToken: signatureParts.join(".") })
    });
    assert.equal(tamperedFocusCompletion.status, 400);

    clock.value = new Date(clock.value.getTime() + 60_000);
    const focusCompletion = await fetch(`${started.baseUrl}/api/focus-sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ sessionToken: focusToken })
    });
    assert.equal(focusCompletion.status, 201);
    const completedFocus = (await focusCompletion.json()).session;
    assert.equal(completedFocus.durationMinutes, 1);
    assert.equal(completedFocus.xpEarned, 3);
    assert.equal(Object.hasOwn(completedFocus, "completionKey"), false);
    assert.equal(storedFocusSessions.length, 1);
    assert.equal(focusXpTransactions.length, 1);

    const replayedFocusCompletion = await fetch(`${started.baseUrl}/api/focus-sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ sessionToken: focusToken })
    });
    assert.equal(replayedFocusCompletion.status, 200);
    assert.equal((await replayedFocusCompletion.json()).session.id, completedFocus.id);
    assert.equal(storedFocusSessions.length, 1);
    assert.equal(focusXpTransactions.length, 1);

    const replayedLegacyCompletion = await fetch(`${started.baseUrl}/api/focus/sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ sessionToken: focusToken })
    });
    assert.equal(replayedLegacyCompletion.status, 200);
    assert.equal((await replayedLegacyCompletion.json()).session.id, completedFocus.id);
    assert.equal(focusXpTransactions.length, 1);

    const overlappingFocusCompletion = await fetch(`${started.baseUrl}/api/focus/sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ sessionToken: overlappingToken })
    });
    assert.equal(overlappingFocusCompletion.status, 409);

    const arbitraryXp = await fetch(`${started.baseUrl}/api/focus/sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ amount: 100000, source: "achievement" })
    });
    assert.equal(arbitraryXp.status, 400);

    const privateRoom = await fetch(`${started.baseUrl}/api/study-rooms`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Private", topic: "Study", isPrivate: true })
    });
    assert.equal(privateRoom.status, 400);

    const createdPrivateRoom = await fetch(`${started.baseUrl}/api/study-rooms`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
            name: "Private room",
            topic: "Revision",
            isPrivate: true,
            passcode: "test-passcode"
        })
    });
    assert.equal(createdPrivateRoom.status, 201);
    const privateRoomData = (await createdPrivateRoom.json()).room;
    assert.match(privateRoomData.inviteCode, /^[0-9a-f]{8}$/);
    assert.equal(Object.hasOwn(privateRoomData, "passcodeHash"), false);

    const createdPublicRoom = await fetch(`${started.baseUrl}/api/study-rooms`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Public room", topic: "Study" })
    });
    assert.equal(createdPublicRoom.status, 201);
    assert.equal((await createdPublicRoom.json()).room.inviteCode, null);

    const invalidCapacity = await fetch(`${started.baseUrl}/api/study-rooms`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Full", topic: "Study", maxParticipants: 101 })
    });
    assert.equal(invalidCapacity.status, 400);

    const invalidReportTarget = await fetch(`${started.baseUrl}/api/reports`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
            targetType: "NOTE",
            targetId: "77777777-7777-4777-8777-777777777777",
            reason: "Spam",
            contentSnippet: "Unwanted content"
        })
    });
    assert.equal(invalidReportTarget.status, 404);

    const unauthorizedAdminReports = await fetch(`${started.baseUrl}/api/admin/reports`, {
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(unauthorizedAdminReports.status, 403);
});

test("product routes reject malformed resource IDs and invalid query/body shapes", async (t) => {
    const userId = "11111111-1111-4111-8111-111111111111";
    process.env.JWT_SECRET = "taskora-product-validation-test-secret-at-least-32";
    const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        subject: userId,
        expiresIn: "1h"
    });
    const unexpectedModel = new Proxy({}, {
        get: () => async () => {
            throw new Error("Malformed input reached a Prisma model");
        }
    });
    const prisma = new Proxy({
        user: { findUnique: async () => ({ role: "ADMIN" }) }
    }, {
        get: (target, property) => Object.hasOwn(target, property)
            ? target[property]
            : unexpectedModel
    });
    const started = await listen(prisma);
    t.after(() => started.server.close());

    const malformedIdRequests = [
        ["PUT", "/api/habits/not-a-uuid/check-ins", { date: "2026-01-01", checked: true }],
        ["DELETE", "/api/habits/not-a-uuid"],
        ["PUT", "/api/notes/not-a-uuid", { title: "Updated" }],
        ["DELETE", "/api/notes/not-a-uuid"],
        ["POST", "/api/study-rooms/not-a-uuid/join", {}],
        ["PATCH", "/api/study-rooms/not-a-uuid", { name: "Updated" }],
        ["DELETE", "/api/study-rooms/not-a-uuid"],
        ["DELETE", "/api/study-rooms/not-a-uuid/participants/me"],
        ["PATCH", "/api/study-rooms/not-a-uuid/timer", { action: "reset" }],
        ["POST", "/api/study-rooms/not-a-uuid/messages", { content: "Hello" }],
        ["GET", "/api/study-rooms/not-a-uuid/events"]
    ];
    for (const [method, path, body] of malformedIdRequests) {
        const response = await fetch(`${started.baseUrl}${path}`, {
            method,
            headers: {
                authorization: `Bearer ${token}`,
                ...(body ? { "content-type": "application/json" } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        assert.equal(response.status, 400, `${method} ${path} should reject malformed IDs`);
    }

    const invalidRequestShapes = [
        ["POST", "/api/reports"],
        ["PATCH", "/api/admin/reports/22222222-2222-4222-8222-222222222222"],
        ["GET", "/api/analytics?period=7d&period=30d"],
        ["GET", "/api/search?q=first&q=second"],
        ["GET", "/api/focus-sessions/today?unknown=value"]
    ];
    for (const [method, path] of invalidRequestShapes) {
        const response = await fetch(`${started.baseUrl}${path}`, {
            method,
            headers: { authorization: `Bearer ${token}` }
        });
        assert.equal(response.status, 400, `${method} ${path} should reject invalid input`);
    }

    const invalidPasscode = await fetch(`${started.baseUrl}/api/study-rooms/22222222-2222-4222-8222-222222222222/join`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ passcode: "x".repeat(65) })
    });
    assert.equal(invalidPasscode.status, 400);
});

test("study room invite codes join members and return room details", async (t) => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const inviteCode = "a1b2c3d4";
    process.env.JWT_SECRET = "taskora-product-route-test-secret-at-least-32";
    const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        subject: userId,
        expiresIn: "1h"
    });
    const room = {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Invite room",
        topic: "Revision",
        isPrivate: true,
        inviteCode,
        passcodeHash: "must-not-be-returned",
        maxParticipants: 2
    };
    const participants = [];
    const tx = {
        studyRoom: {
            findUnique: async ({ where }) => {
                if (where.inviteCode && where.inviteCode !== inviteCode) return null;
                if (where.id && where.id !== room.id) return null;
                return {
                    ...room,
                    participants: participants.map((participant) => ({
                        ...participant,
                        user: { id: participant.userId, name: "Study member", avatar: null }
                    })),
                    messages: []
                };
            }
        },
        roomParticipant: {
            findUnique: async ({ where }) => participants.find((participant) =>
                participant.roomId === where.roomId_userId.roomId &&
                participant.userId === where.roomId_userId.userId
            ) || null,
            count: async () => participants.length,
            upsert: async ({ create, update }) => {
                const existing = participants.find((participant) =>
                    participant.roomId === create.roomId && participant.userId === create.userId
                );
                if (existing) {
                    Object.assign(existing, update);
                    return existing;
                }
                const participant = { id: "participant-id", ...create, joinedAt: new Date() };
                participants.push(participant);
                return participant;
            }
        }
    };
    const started = await listen({ $transaction: (callback) => callback(tx) });
    t.after(() => started.server.close());

    const headers = { authorization: `Bearer ${token}` };
    const missingRoom = await fetch(
        `${started.baseUrl}/api/study-rooms/join-invite/deadbeef`,
        { method: "POST", headers }
    );
    assert.equal(missingRoom.status, 404);

    participants.push(
        { roomId: room.id, userId: "22222222-2222-4222-8222-222222222222" },
        { roomId: room.id, userId: "33333333-3333-4333-8333-333333333333" }
    );
    const fullRoom = await fetch(
        `${started.baseUrl}/api/study-rooms/join-invite/${inviteCode}`,
        { method: "POST", headers }
    );
    assert.equal(fullRoom.status, 409);

    participants.length = 0;
    const joined = await fetch(
        `${started.baseUrl}/api/study-rooms/join-invite/${inviteCode}`,
        { method: "POST", headers }
    );
    assert.equal(joined.status, 200);
    const payload = await joined.json();
    assert.equal(payload.joined, true);
    assert.equal(payload.room.id, room.id);
    assert.equal(payload.room.name, room.name);
    assert.equal(payload.room.inviteCode, inviteCode);
    assert.equal(payload.room.participants.length, 1);
    assert.equal(payload.room.participants[0].userId, userId);
    assert.equal("passcodeHash" in payload.room, false);

    const malformedCode = await fetch(
        `${started.baseUrl}/api/study-rooms/join-invite/not-a-code`,
        { method: "POST", headers }
    );
    assert.equal(malformedCode.status, 404);
});
