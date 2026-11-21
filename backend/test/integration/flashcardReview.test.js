"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../../src/config/auth");

function getSafeTestDatabaseUrl(value) {
    if (!value) return null;

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error("TASKORA_TEST_DATABASE_URL must be a valid PostgreSQL URL");
    }

    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        url.hostname !== "127.0.0.1" ||
        !url.port ||
        !/^taskora_test_[a-z0-9_]+$/.test(databaseName)
    ) {
        throw new Error(
            "Flashcard integration tests require a loopback URL and a taskora_test_* database"
        );
    }
    return value;
}

const testDatabaseUrl = getSafeTestDatabaseUrl(process.env.TASKORA_TEST_DATABASE_URL);
if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET = "taskora-flashcard-integration-test-only-secret";
}

async function listen(app) {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    return server;
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

function tokenFor(userId) {
    return jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        expiresIn: "1h",
        issuer: JWT_ISSUER,
        subject: userId
    });
}

async function request(baseUrl, method, path, token, body) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { "content-type": "application/json" })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return {
        response,
        body: response.status === 204 ? null : await response.json()
    };
}

test("three same-day flashcard reviews persist the correct SM-2 schedule", {
    skip: testDatabaseUrl
        ? false
        : "Set TASKORA_TEST_DATABASE_URL to an isolated loopback test database"
}, async (t) => {
    const prisma = require("../../src/lib/prisma");
    const { createFlashcardRouter } = require("../../src/routes/flashcardRoutes");
    const reviewTimes = [
        new Date("2026-11-21T08:00:00.000Z"),
        new Date("2026-11-21T09:00:00.000Z"),
        new Date("2026-11-21T10:00:00.000Z")
    ];
    let reviewIndex = 0;
    let userId;
    let server;
    const app = express();
    app.use(express.json());
    app.use("/api/flashcards", createFlashcardRouter(prisma, {
        now: () => reviewTimes[reviewIndex++]
    }));
    app.use((error, req, res, next) => res.status(500).json({ error: "Internal server error" }));

    t.after(async () => {
        try {
            if (server) await close(server);
            if (userId) await prisma.user.deleteMany({ where: { id: userId } });
        } finally {
            await prisma.$disconnect();
        }
    });
    server = await listen(app);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const user = await prisma.user.create({
        data: {
            name: "Flashcard integration",
            email: `${randomUUID()}@taskora.test`,
            password: await bcrypt.hash("Taskora-Flashcard-Test-12345", 4)
        },
        select: { id: true }
    });
    userId = user.id;
    const token = tokenFor(user.id);

    const deckResult = await request(baseUrl, "POST", "/api/flashcards/decks", token, {
        title: "SM-2 integration"
    });
    assert.equal(deckResult.response.status, 201);

    const cardResult = await request(
        baseUrl,
        "POST",
        `/api/flashcards/decks/${deckResult.body.deck.id}/cards`,
        token,
        { front: "Question", back: "Answer" }
    );
    assert.equal(cardResult.response.status, 201);
    const cardId = cardResult.body.card.id;

    const reviewPaths = [
        `/api/flashcards/${cardId}/review`,
        `/api/flashcards/cards/${cardId}/review`,
        `/api/flashcards/${cardId}/review`
    ];
    const expectedStates = [
        { repetitions: 1, intervalDays: 1, easeFactor: 2.6, reviewCount: 1 },
        { repetitions: 2, intervalDays: 6, easeFactor: 2.7, reviewCount: 2 },
        { repetitions: 3, intervalDays: 16, easeFactor: 2.8, reviewCount: 3 }
    ];
    let previousDueAt;

    for (let index = 0; index < reviewPaths.length; index += 1) {
        const result = await request(baseUrl, "POST", reviewPaths[index], token, { quality: 5 });
        assert.equal(result.response.status, 200);

        const card = result.body.card;
        const expected = expectedStates[index];
        assert.equal(card.repetitions, expected.repetitions);
        assert.equal(card.intervalDays, expected.intervalDays);
        assert.ok(Math.abs(card.easeFactor - expected.easeFactor) < 1e-10);
        assert.equal(card.reviewCount, expected.reviewCount);
        assert.equal(card.lastReviewedAt, reviewTimes[index].toISOString());
        assert.equal(
            card.dueAt,
            new Date(reviewTimes[index].getTime() + expected.intervalDays * 24 * 60 * 60 * 1000).toISOString()
        );
        assert.equal(card.lastReviewedAt.slice(0, 10), reviewTimes[0].toISOString().slice(0, 10));
        if (previousDueAt) assert.notEqual(card.dueAt, previousDueAt);
        previousDueAt = card.dueAt;
    }

    const persistedCard = await prisma.flashcard.findUnique({ where: { id: cardId } });
    assert.equal(persistedCard.repetitions, 3);
    assert.equal(persistedCard.intervalDays, 16);
    assert.ok(Math.abs(persistedCard.easeFactor - 2.8) < 1e-10);
    assert.equal(persistedCard.reviewCount, 3);
    assert.equal(
        persistedCard.dueAt.toISOString(),
        new Date(reviewTimes[2].getTime() + 16 * 24 * 60 * 60 * 1000).toISOString()
    );
});
