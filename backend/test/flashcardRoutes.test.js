"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");
const { createFlashcardRouter, nextReviewState } = require("../src/routes/flashcardRoutes");
const { JWT_ISSUER, JWT_AUDIENCE } = require("../src/config/auth");

async function listen(prisma) {
    const app = express();
    app.use(express.json());
    app.use("/api/flashcards", createFlashcardRouter(prisma));
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

test("flashcard routes require authentication and scope deck access to its owner", async (t) => {
    process.env.JWT_SECRET = "taskora-flashcard-route-test-secret-at-least-32";
    const ownerId = "11111111-1111-4111-8111-111111111111";
    const storedDecks = new Map([["deck-1", {
        id: "deck-1",
        userId: ownerId,
        title: "Test deck",
        description: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        cards: []
    }]]);
    const storedCards = new Map();
    const prisma = {
        flashcardDeck: {
            findMany: async (args) => {
                assert.equal(args.where.userId, ownerId);
                return [...storedDecks.values()].map((deck) => ({
                    id: deck.id, userId: deck.userId, title: deck.title, description: deck.description,
                    createdAt: deck.createdAt, updatedAt: deck.updatedAt,
                    _count: { cards: deck.cards.length }
                }));
            },
            findFirst: async (args) => {
                const deck = storedDecks.get(args.where.id);
                if (!deck || deck.userId !== args.where.userId) return null;
                if (args.select.cards) return { ...deck, cards: deck.cards };
                return {
                    id: deck.id, userId: deck.userId, title: deck.title, description: deck.description,
                    createdAt: deck.createdAt, updatedAt: deck.updatedAt,
                    _count: { cards: deck.cards.length }
                };
            },
            create: async (args) => {
                const deck = {
                    id: "deck-new", ...args.data,
                    createdAt: new Date(), updatedAt: new Date(), cards: []
                };
                storedDecks.set(deck.id, deck);
                const { cards, ...result } = deck;
                return result;
            },
            updateMany: async (args) => {
                const deck = storedDecks.get(args.where.id);
                if (!deck || deck.userId !== args.where.userId) return { count: 0 };
                Object.assign(deck, args.data);
                return { count: 1 };
            },
            deleteMany: async (args) => {
                const deck = storedDecks.get(args.where.id);
                if (!deck || deck.userId !== args.where.userId) return { count: 0 };
                storedDecks.delete(deck.id);
                return { count: 1 };
            }
        },
        flashcard: {
            count: async (args) => storedCards.size,
            create: async (args) => {
                const card = {
                    id: "card-1", repetitions: 0, intervalDays: 0, easeFactor: 2.5,
                    reviewCount: 0, dueAt: new Date(), lastReviewedAt: null,
                    createdAt: new Date(), updatedAt: new Date(), ...args.data
                };
                storedCards.set(card.id, card);
                storedDecks.get(card.deckId).cards.push(card);
                return card;
            },
            findFirst: async (args) => {
                const card = storedCards.get(args.where.id);
                if (!card || storedDecks.get(card.deckId)?.userId !== args.where.deck.userId) return null;
                return card;
            },
            update: async (args) => {
                const card = { ...storedCards.get(args.where.id), ...args.data };
                storedCards.set(card.id, card);
                return card;
            },
            delete: async (args) => {
                const card = storedCards.get(args.where.id);
                storedCards.delete(card.id);
                storedDecks.get(card.deckId).cards = storedDecks.get(card.deckId).cards.filter((item) => item.id !== card.id);
            }
        }
    };
    const server = await listen(prisma);
    t.after(() => server.server.close());

    const unauthenticated = await fetch(`${server.baseUrl}/api/flashcards/decks`);
    assert.equal(unauthenticated.status, 401);

    const list = await fetch(`${server.baseUrl}/api/flashcards/decks`, { headers: authHeader(ownerId) });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).decks[0]._count.cards, 0);

    const otherUserRead = await fetch(`${server.baseUrl}/api/flashcards/decks/deck-1`, {
        headers: authHeader("22222222-2222-4222-8222-222222222222")
    });
    assert.equal(otherUserRead.status, 404);

    const invalidCard = await fetch(`${server.baseUrl}/api/flashcards/decks/deck-1/cards`, {
        method: "POST",
        headers: { ...authHeader(ownerId), "Content-Type": "application/json" },
        body: JSON.stringify({ front: "Question", back: "Answer", userId: "another-user" })
    });
    assert.equal(invalidCard.status, 400);

    const created = await fetch(`${server.baseUrl}/api/flashcards/decks/deck-1/cards`, {
        method: "POST",
        headers: { ...authHeader(ownerId), "Content-Type": "application/json" },
        body: JSON.stringify({ front: "Question", back: "Answer" })
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).card.position, 0);

    const invalidReview = await fetch(`${server.baseUrl}/api/flashcards/cards/card-1/review`, {
        method: "POST",
        headers: { ...authHeader(ownerId), "Content-Type": "application/json" },
        body: JSON.stringify({ quality: 6 })
    });
    assert.equal(invalidReview.status, 400);
});

test("SM-2 review scheduling resets failed cards and advances successful cards", () => {
    const reviewedAt = new Date("2026-01-01T00:00:00.000Z");
    const card = { repetitions: 2, intervalDays: 6, easeFactor: 2.5, reviewCount: 4 };

    const failed = nextReviewState(card, 2, reviewedAt);
    assert.equal(failed.repetitions, 0);
    assert.equal(failed.intervalDays, 1);
    assert.equal(failed.reviewCount, 5);
    assert.equal(failed.dueAt.toISOString(), "2026-01-02T00:00:00.000Z");

    const passed = nextReviewState(card, 4, reviewedAt);
    assert.equal(passed.repetitions, 3);
    assert.equal(passed.intervalDays, 15);
    assert.equal(passed.dueAt.toISOString(), "2026-01-16T00:00:00.000Z");
});
