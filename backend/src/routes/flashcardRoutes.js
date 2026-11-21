const express = require("express");
const authenticateToken = require("../middleware/authenticateToken");

const DECK_SELECT = {
    id: true,
    userId: true,
    title: true,
    description: true,
    createdAt: true,
    updatedAt: true
};

const CARD_SELECT = {
    id: true,
    deckId: true,
    front: true,
    back: true,
    position: true,
    repetitions: true,
    intervalDays: true,
    easeFactor: true,
    reviewCount: true,
    dueAt: true,
    lastReviewedAt: true,
    createdAt: true,
    updatedAt: true
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuidParam(req, res, parameter, label) {
    if (UUID_PATTERN.test(req.params[parameter])) return true;
    res.status(400).json({ error: `Invalid ${label} ID` });
    return false;
}

function isObjectBody(body) {
    return body !== null && typeof body === "object" && !Array.isArray(body);
}

function validateDeckBody(body, partial = false) {
    if (!isObjectBody(body)) return null;
    const allowed = new Set(["title", "description"]);
    if (Object.keys(body).some((field) => !allowed.has(field))) return null;
    if (!partial && !Object.hasOwn(body, "title")) return null;

    const data = {};
    if (Object.hasOwn(body, "title")) {
        if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120) {
            return null;
        }
        data.title = body.title.trim();
    }
    if (Object.hasOwn(body, "description")) {
        if (body.description !== null && typeof body.description !== "string") return null;
        const description = typeof body.description === "string" ? body.description.trim() : "";
        if (description.length > 1000) return null;
        data.description = description || null;
    }
    if (partial && Object.keys(data).length === 0) return null;
    return data;
}

function validateCardBody(body, partial = false) {
    if (!isObjectBody(body)) return null;
    const allowed = new Set(["front", "back", "position"]);
    if (Object.keys(body).some((field) => !allowed.has(field))) return null;
    if (!partial && (!Object.hasOwn(body, "front") || !Object.hasOwn(body, "back"))) return null;

    const data = {};
    for (const field of ["front", "back"]) {
        if (!Object.hasOwn(body, field)) continue;
        if (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > 4000) {
            return null;
        }
        data[field] = body[field].trim();
    }
    if (Object.hasOwn(body, "position")) {
        if (!Number.isSafeInteger(body.position) || body.position < 0) return null;
        data.position = body.position;
    }
    if (partial && Object.keys(data).length === 0) return null;
    return data;
}

function nextReviewState(card, quality, reviewedAt) {
    let repetitions = card.repetitions;
    let intervalDays = card.intervalDays;
    let easeFactor = card.easeFactor;

    if (quality < 3) {
        repetitions = 0;
        intervalDays = 1;
    } else {
        repetitions += 1;
        if (repetitions === 1) intervalDays = 1;
        else if (repetitions === 2) intervalDays = 6;
        else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }

    const difficulty = 5 - quality;
    easeFactor = Math.max(
        1.3,
        easeFactor + 0.1 - difficulty * (0.08 + difficulty * 0.02)
    );

    return {
        repetitions,
        intervalDays,
        easeFactor,
        reviewCount: card.reviewCount + 1,
        lastReviewedAt: reviewedAt,
        dueAt: new Date(reviewedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000)
    };
}

function createFlashcardRouter(prisma, { now = () => new Date() } = {}) {
    const router = express.Router();
    router.use(authenticateToken);

    router.get("/decks", async (req, res, next) => {
        try {
            const decks = await prisma.flashcardDeck.findMany({
                where: { userId: req.user.id },
                orderBy: { updatedAt: "desc" },
                select: { ...DECK_SELECT, _count: { select: { cards: true } } }
            });
            res.json({ decks });
        } catch (error) {
            next(error);
        }
    });

    router.post("/decks", async (req, res, next) => {
        const data = validateDeckBody(req.body);
        if (!data) return res.status(400).json({ error: "Deck title and description are invalid" });
        try {
            const deck = await prisma.flashcardDeck.create({
                data: { ...data, userId: req.user.id },
                select: DECK_SELECT
            });
            res.status(201).json({ deck });
        } catch (error) {
            next(error);
        }
    });

    router.get("/decks/:deckId", async (req, res, next) => {
        if (!requireUuidParam(req, res, "deckId", "Flashcard deck")) return;
        try {
            const deck = await prisma.flashcardDeck.findFirst({
                where: { id: req.params.deckId, userId: req.user.id },
                select: {
                    ...DECK_SELECT,
                    _count: { select: { cards: true } },
                    cards: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: CARD_SELECT }
                }
            });
            if (!deck) return res.status(404).json({ error: "Flashcard deck not found" });
            res.json({ deck });
        } catch (error) {
            next(error);
        }
    });

    router.patch("/decks/:deckId", async (req, res, next) => {
        if (!requireUuidParam(req, res, "deckId", "Flashcard deck")) return;
        const data = validateDeckBody(req.body, true);
        if (!data) return res.status(400).json({ error: "Deck fields are invalid" });
        try {
            const result = await prisma.flashcardDeck.updateMany({
                where: { id: req.params.deckId, userId: req.user.id },
                data
            });
            if (result.count === 0) return res.status(404).json({ error: "Flashcard deck not found" });
            const deck = await prisma.flashcardDeck.findFirst({
                where: { id: req.params.deckId, userId: req.user.id },
                select: { ...DECK_SELECT, _count: { select: { cards: true } } }
            });
            res.json({ deck });
        } catch (error) {
            next(error);
        }
    });

    router.delete("/decks/:deckId", async (req, res, next) => {
        if (!requireUuidParam(req, res, "deckId", "Flashcard deck")) return;
        try {
            const result = await prisma.flashcardDeck.deleteMany({
                where: { id: req.params.deckId, userId: req.user.id }
            });
            if (result.count === 0) return res.status(404).json({ error: "Flashcard deck not found" });
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    router.post("/decks/:deckId/cards", async (req, res, next) => {
        if (!requireUuidParam(req, res, "deckId", "Flashcard deck")) return;
        const data = validateCardBody(req.body);
        if (!data) return res.status(400).json({ error: "Card front and back are invalid" });
        try {
            const deck = await prisma.flashcardDeck.findFirst({
                where: { id: req.params.deckId, userId: req.user.id },
                select: { id: true }
            });
            if (!deck) return res.status(404).json({ error: "Flashcard deck not found" });
            const position = data.position ?? await prisma.flashcard.count({ where: { deckId: deck.id } });
            const card = await prisma.flashcard.create({
                data: { deckId: deck.id, front: data.front, back: data.back, position },
                select: CARD_SELECT
            });
            res.status(201).json({ card });
        } catch (error) {
            next(error);
        }
    });

    router.patch("/cards/:cardId", async (req, res, next) => {
        if (!requireUuidParam(req, res, "cardId", "Flashcard")) return;
        const data = validateCardBody(req.body, true);
        if (!data) return res.status(400).json({ error: "Card fields are invalid" });
        try {
            const existing = await prisma.flashcard.findFirst({
                where: { id: req.params.cardId, deck: { userId: req.user.id } },
                select: { id: true }
            });
            if (!existing) return res.status(404).json({ error: "Flashcard not found" });
            const card = await prisma.flashcard.update({
                where: { id: existing.id },
                data,
                select: CARD_SELECT
            });
            res.json({ card });
        } catch (error) {
            next(error);
        }
    });

    router.delete("/cards/:cardId", async (req, res, next) => {
        if (!requireUuidParam(req, res, "cardId", "Flashcard")) return;
        try {
            const existing = await prisma.flashcard.findFirst({
                where: { id: req.params.cardId, deck: { userId: req.user.id } },
                select: { id: true }
            });
            if (!existing) return res.status(404).json({ error: "Flashcard not found" });
            await prisma.flashcard.delete({ where: { id: existing.id } });
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    const reviewCard = async (req, res, next) => {
        if (!requireUuidParam(req, res, "cardId", "Flashcard")) return;
        if (!isObjectBody(req.body) ||
            Object.keys(req.body).length !== 1 ||
            !Number.isInteger(req.body.quality) ||
            req.body.quality < 0 ||
            req.body.quality > 5) {
            return res.status(400).json({ error: "Review quality must be a whole number from 0 to 5" });
        }
        try {
            const card = await prisma.flashcard.findFirst({
                where: { id: req.params.cardId, deck: { userId: req.user.id } },
                select: CARD_SELECT
            });
            if (!card) return res.status(404).json({ error: "Flashcard not found" });
            const updated = await prisma.flashcard.update({
                where: { id: card.id },
                data: nextReviewState(card, req.body.quality, now()),
                select: CARD_SELECT
            });
            res.json({ card: updated });
        } catch (error) {
            next(error);
        }
    };

    router.post("/cards/:cardId/review", reviewCard);
    router.post("/:cardId/review", reviewCard);

    return router;
}

module.exports = { createFlashcardRouter, nextReviewState };
