const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const authenticateToken = require("../middleware/authenticateToken");
const { longestHabitStreak, getAchievementProgress } = require("../services/achievementService");
const { getLocalDayRange } = require("../lib/localDayRange");
const roomStreams = new Map();
const FOCUS_SESSION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOCUS_SESSION_SELECT = {
    id: true,
    userId: true,
    subject: true,
    durationMinutes: true,
    notes: true,
    xpEarned: true,
    completedAt: true
};

function isValidUuid(value) {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

function requireResourceId(req, res, label) {
    if (isValidUuid(req.params.id)) return true;
    res.status(400).json({ error: `Invalid ${label} ID` });
    return false;
}

function broadcastRoom(roomId, event) {
    const streams = roomStreams.get(roomId);
    if (!streams) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const stream of streams) {
        stream.write(payload);
    }
}

function getRoomRemainingSeconds(room, at = new Date()) {
    if (!room.timerStartedAt) return room.timerRemainingSeconds;
    const elapsed = Math.floor((at.getTime() - room.timerStartedAt.getTime()) / 1000);
    return Math.max(0, room.timerRemainingSeconds - Math.max(0, elapsed));
}

function serializeStudyRoom(room) {
    const { passcodeHash, participants = [], ...safeRoom } = room;
    return {
        ...safeRoom,
        participants: participants.map((participant) => ({
            id: participant.id,
            userId: participant.userId,
            status: participant.status,
            joinedAt: participant.joinedAt,
            user: participant.user
                ? {
                    id: participant.user.id,
                    name: participant.user.name,
                    avatar: participant.user.avatar
                }
                : null
        }))
    };
}

function parseCivilDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (
        year < 1 ||
        month < 1 ||
        month > 12 ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }
    return date;
}

function encodeFocusToken(payload, secret) {
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    return `${data}.${signature}`;
}

function decodeFocusToken(token, secret, userId, now) {
    if (typeof token !== "string" || token.length > 2048) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest();
    let supplied;
    try {
        supplied = Buffer.from(parts[1], "base64url");
    } catch {
        return null;
    }
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        return null;
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    } catch {
        return null;
    }
    if (
        !payload ||
        payload.userId !== userId ||
        typeof payload.subject !== "string" ||
        !payload.subject.trim() ||
        !Number.isInteger(payload.durationMinutes) ||
        payload.durationMinutes < 1 ||
        payload.durationMinutes > 1440 ||
        typeof payload.nonce !== "string" ||
        !/^[a-f0-9]{32}$/.test(payload.nonce) ||
        !Number.isSafeInteger(payload.startedAt) ||
        !Number.isSafeInteger(payload.expiresAt)
    ) {
        return null;
    }
    const nowMs = now.getTime();
    if (
        payload.startedAt > nowMs + 5000 ||
        payload.expiresAt <= nowMs ||
        payload.expiresAt - payload.startedAt !== FOCUS_SESSION_TOKEN_TTL_MS
    ) {
        return null;
    }
    return payload;
}

function createProductRouter(prisma, { now = () => new Date() } = {}) {
    const router = express.Router();

    router.get("/notes/shared/:shareCode", async (req, res, next) => {
        if (!/^[a-f0-9]{32}$/.test(req.params.shareCode)) {
            return res.status(404).json({ error: "Shared note not found" });
        }
        try {
            const note = await prisma.studyNote.findFirst({
                where: { shareCode: req.params.shareCode, isPrivate: false },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    subjectName: true,
                    tags: true,
                    updatedAt: true
                }
            });
            if (!note) return res.status(404).json({ error: "Shared note not found" });
            return res.json({ note });
        } catch (error) { return next(error); }
    });

    router.use(authenticateToken);

    router.get("/habits", async (req, res, next) => {
        try {
            const habits = await prisma.habit.findMany({
                where: { userId: req.user.id },
                include: { checkIns: true },
                orderBy: { createdAt: "desc" }
            });
            res.json({ habits });
        } catch (error) { next(error); }
    });

    router.post("/habits", async (req, res, next) => {
        try {
            const allowed = new Set([
                "title", "description", "category", "color", "iconName", "frequency", "reminderTime"
            ]);
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => !allowed.has(field))) {
                return res.status(400).json({ error: "Habit fields are invalid" });
            }
            const { title, description, category, color, iconName, frequency, reminderTime } = req.body;
            if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
                return res.status(400).json({ error: "Habit title must be 1-120 characters" });
            }
            if (description !== undefined &&
                (description !== null &&
                    (typeof description !== "string" || description.length > 1000))) {
                return res.status(400).json({ error: "Habit description must be at most 1000 characters" });
            }
            if (category !== undefined &&
                (typeof category !== "string" || !category.trim() || category.trim().length > 64)) {
                return res.status(400).json({ error: "Habit category must be 1-64 characters" });
            }
            if (color !== undefined && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
                return res.status(400).json({ error: "Habit color must be a six-digit hex color" });
            }
            if (iconName !== undefined && (typeof iconName !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(iconName))) {
                return res.status(400).json({ error: "Habit icon name is invalid" });
            }
            if (frequency !== undefined && !["daily", "weekly"].includes(frequency)) {
                return res.status(400).json({ error: "Habit frequency must be daily or weekly" });
            }
            if (reminderTime !== undefined && reminderTime !== null &&
                (typeof reminderTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminderTime))) {
                return res.status(400).json({ error: "Habit reminder time must use HH:MM" });
            }
            const habit = await prisma.habit.create({
                data: {
                    userId: req.user.id,
                    title: title.trim(),
                    description: typeof description === "string" ? description.trim() || null : null,
                    category: typeof category === "string" ? category.trim() : "Study",
                    color: typeof color === "string" ? color : "#9885E8",
                    iconName: typeof iconName === "string" ? iconName : "Flame",
                    frequency: typeof frequency === "string" ? frequency : "daily",
                    reminderTime: typeof reminderTime === "string" ? reminderTime : null
                }
            });
            res.status(201).json({ habit });
        } catch (error) { next(error); }
    });

    router.put("/habits/:id/check-ins", async (req, res, next) => {
        if (!requireResourceId(req, res, "Habit")) return;
        try {
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
                return res.status(400).json({ error: "A valid date and checked state are required" });
            }
            const date = parseCivilDate(req.body.date);
            if (!date || typeof req.body.checked !== "boolean" ||
                Object.keys(req.body).some((field) => !["date", "checked"].includes(field))) {
                return res.status(400).json({ error: "A valid date and checked state are required" });
            }
            const habit = await prisma.habit.findFirst({ where: { id: req.params.id, userId: req.user.id } });
            if (!habit) return res.status(404).json({ error: "Habit not found" });
            if (!req.body.checked) {
                await prisma.habitCheckIn.deleteMany({
                    where: { habitId: habit.id, userId: req.user.id, date }
                });
                return res.json({ checked: false });
            }
            await prisma.habitCheckIn.upsert({
                where: { habitId_date: { habitId: habit.id, date } },
                create: { habitId: habit.id, userId: req.user.id, date },
                update: {}
            });
            res.json({ checked: true });
        } catch (error) { next(error); }
    });

    router.delete("/habits/:id", async (req, res, next) => {
        if (!requireResourceId(req, res, "Habit")) return;
        try {
            const deleted = await prisma.habit.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
            if (deleted.count === 0) return res.status(404).json({ error: "Habit not found" });
            res.status(204).end();
        } catch (error) { next(error); }
    });

    router.get("/notes", async (req, res, next) => {
        try {
            const notes = await prisma.studyNote.findMany({
                where: { userId: req.user.id },
                orderBy: { updatedAt: "desc" }
            });
            res.json({ notes });
        } catch (error) { next(error); }
    });

    router.post("/notes", async (req, res, next) => {
        try {
            const allowed = new Set([
                "title", "content", "subjectId", "subjectName", "tags", "isPrivate"
            ]);
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => !allowed.has(field))) {
                return res.status(400).json({ error: "Note fields are invalid" });
            }
            const { title, content, subjectId, subjectName, tags, isPrivate } = req.body;
            if (typeof title !== "string" || !title.trim() || title.trim().length > 160) {
                return res.status(400).json({ error: "Note title must be 1-160 characters" });
            }
            if (content !== undefined && (typeof content !== "string" || content.length > 20000)) {
                return res.status(400).json({ error: "Note content must be at most 20000 characters" });
            }
            if (tags !== undefined && (
                !Array.isArray(tags) ||
                tags.length > 50 ||
                tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 64)
            )) {
                return res.status(400).json({ error: "Note tags must contain at most 50 non-empty strings" });
            }
            if (isPrivate !== undefined && typeof isPrivate !== "boolean") {
                return res.status(400).json({ error: "isPrivate must be a boolean" });
            }
            if (subjectId !== undefined && subjectId !== null && typeof subjectId !== "string") {
                return res.status(400).json({ error: "subjectId must be a string or null" });
            }
            if (subjectName !== undefined && subjectName !== null &&
                (typeof subjectName !== "string" || subjectName.length > 160)) {
                return res.status(400).json({ error: "subjectName must be at most 160 characters" });
            }
            const note = await prisma.studyNote.create({
                data: {
                    userId: req.user.id,
                    title: title.trim(),
                    content: typeof content === "string" ? content : "",
                    subjectId: typeof subjectId === "string" ? subjectId.trim() || null : null,
                    subjectName: typeof subjectName === "string" ? subjectName.trim() || null : null,
                    tags: Array.isArray(tags) ? tags.map((tag) => tag.trim()) : [],
                    isPrivate: typeof isPrivate === "boolean" ? isPrivate : true,
                    shareCode: isPrivate === false ? crypto.randomBytes(16).toString("hex") : null
                }
            });
            res.status(201).json({ note });
        } catch (error) { next(error); }
    });

    router.put("/notes/:id", async (req, res, next) => {
        if (!requireResourceId(req, res, "Note")) return;
        try {
            const allowed = new Set([
                "title", "content", "subjectId", "subjectName", "tags", "isPrivate"
            ]);
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
                Object.keys(req.body).length === 0 ||
                Object.keys(req.body).some((field) => !allowed.has(field))) {
                return res.status(400).json({ error: "Note fields are invalid" });
            }
            const current = await prisma.studyNote.findFirst({ where: { id: req.params.id, userId: req.user.id } });
            if (!current) return res.status(404).json({ error: "Note not found" });
            const data = {};
            for (const field of allowed) {
                if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
                const value = req.body[field];
                if (field === "title" &&
                    (typeof value !== "string" || !value.trim() || value.trim().length > 160)) {
                    return res.status(400).json({ error: "Note title must be 1-160 characters" });
                }
                if (field === "content" &&
                    (typeof value !== "string" || value.length > 20000)) {
                    return res.status(400).json({ error: "Note content must be at most 20000 characters" });
                }
                if (field === "tags" && (
                    !Array.isArray(value) ||
                    value.length > 50 ||
                    value.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 64)
                )) {
                    return res.status(400).json({ error: "Note tags must contain at most 50 non-empty strings" });
                }
                if (field === "isPrivate" && typeof value !== "boolean") {
                    return res.status(400).json({ error: "isPrivate must be a boolean" });
                }
                if (["subjectId", "subjectName"].includes(field) &&
                    value !== null && typeof value !== "string") {
                    return res.status(400).json({ error: `${field} must be a string or null` });
                }
                data[field] = field === "title" || field === "subjectName"
                    ? (typeof value === "string" ? value.trim() : value)
                    : field === "tags"
                        ? value.map((tag) => tag.trim())
                        : value;
            }
            if (req.body.isPrivate === false) {
                data.shareCode = current.shareCode || crypto.randomBytes(16).toString("hex");
            } else if (req.body.isPrivate === true) {
                data.shareCode = null;
            }
            const note = await prisma.studyNote.update({ where: { id: current.id }, data });
            res.json({ note });
        } catch (error) { next(error); }
    });

    router.delete("/notes/:id", async (req, res, next) => {
        if (!requireResourceId(req, res, "Note")) return;
        try {
            const deleted = await prisma.studyNote.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
            if (deleted.count === 0) return res.status(404).json({ error: "Note not found" });
            res.status(204).end();
        } catch (error) { next(error); }
    });

    router.get("/focus/sessions", async (req, res, next) => {
        try {
            const sessions = await prisma.focusSession.findMany({
                where: { userId: req.user.id },
                orderBy: { completedAt: "desc" },
                take: 100,
                select: FOCUS_SESSION_SELECT
            });
            res.json({ sessions });
        } catch (error) { next(error); }
    });

    router.get("/focus-sessions/today", async (req, res, next) => {
        try {
            const unsupportedQuery = Object.keys(req.query).find((field) => field !== "timeZone");
            if (unsupportedQuery) {
                return res.status(400).json({ error: `Unsupported query parameter: ${unsupportedQuery}` });
            }
            const requestedTimeZone = req.user.timeZone || req.query.timeZone || "UTC";
            if (typeof requestedTimeZone !== "string" || !requestedTimeZone.trim()) {
                return res.status(400).json({ error: "A valid time zone is required" });
            }

            let range;
            try {
                range = getLocalDayRange(now(), requestedTimeZone.trim());
            } catch (error) {
                if (error instanceof RangeError) {
                    return res.status(400).json({ error: "A valid time zone is required" });
                }
                throw error;
            }

            const aggregate = await prisma.focusSession.aggregate({
                where: {
                    userId: req.user.id,
                    completedAt: { gte: range.start, lt: range.end }
                },
                _sum: { durationMinutes: true }
            });
            return res.json({
                date: range.date,
                timeZone: requestedTimeZone.trim(),
                totalFocusMinutes: aggregate._sum.durationMinutes || 0
            });
        } catch (error) {
            return next(error);
        }
    });

    router.post("/focus/sessions/start", async (req, res) => {
        if (
            !req.body ||
            typeof req.body !== "object" ||
            Array.isArray(req.body) ||
            Object.keys(req.body).some((field) => !["subject", "durationMinutes"].includes(field))
        ) {
            return res.status(400).json({ error: "Subject and duration are required" });
        }
        const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
        const durationMinutes = req.body.durationMinutes;
        if (!subject || subject.length > 120 || !Number.isInteger(durationMinutes) ||
            durationMinutes < 1 || durationMinutes > 1440) {
            return res.status(400).json({ error: "Subject and duration are invalid" });
        }
        const startedAt = now().getTime();
        const sessionToken = encodeFocusToken({
            userId: req.user.id,
            subject,
            durationMinutes,
            startedAt,
            expiresAt: startedAt + FOCUS_SESSION_TOKEN_TTL_MS,
            nonce: crypto.randomBytes(16).toString("hex")
        }, process.env.JWT_SECRET);
        return res.status(201).json({ sessionToken });
    });

    const completeFocusSession = async (req, res, next) => {
        let payload;
        try {
            if (
                !req.body ||
                typeof req.body !== "object" ||
                Array.isArray(req.body) ||
                Object.keys(req.body).length !== 1 ||
                Object.keys(req.body)[0] !== "sessionToken"
            ) {
                return res.status(400).json({ error: "A valid focus session token is required" });
            }
            const completedAt = now();
            payload = decodeFocusToken(
                req.body.sessionToken,
                process.env.JWT_SECRET,
                req.user.id,
                completedAt
            );
            if (!payload) return res.status(400).json({ error: "Focus session token is invalid or expired" });
            if (completedAt.getTime() - payload.startedAt < payload.durationMinutes * 60 * 1000) {
                return res.status(409).json({ error: "Focus session duration has not elapsed" });
            }
            const existing = await prisma.focusSession.findUnique({
                where: { completionKey: payload.nonce },
                select: FOCUS_SESSION_SELECT
            });
            if (existing && existing.userId === req.user.id) {
                return res.status(200).json({ session: existing });
            }
            const durationMinutes = payload.durationMinutes;
            const xpEarned = Math.round(durationMinutes * 2.5);
            const result = await prisma.$transaction(async (tx) => {
                const duplicate = await tx.focusSession.findUnique({
                    where: { completionKey: payload.nonce },
                    select: FOCUS_SESSION_SELECT
                });
                if (duplicate) {
                    return duplicate.userId === req.user.id
                        ? { session: duplicate, duplicate: true }
                        : { conflict: true };
                }
                const latest = await tx.focusSession.findFirst({
                    where: { userId: req.user.id },
                    orderBy: { completedAt: "desc" },
                    select: { completedAt: true }
                });
                if (latest && payload.startedAt < latest.completedAt.getTime()) {
                    return { conflict: true };
                }
                const session = await tx.focusSession.create({
                    data: {
                        userId: req.user.id,
                        subject: payload.subject,
                        durationMinutes,
                        xpEarned,
                        completionKey: payload.nonce,
                        completedAt
                    },
                    select: FOCUS_SESSION_SELECT
                });
                await tx.xPTransaction.createMany({
                    data: [{
                        userId: req.user.id,
                        amount: xpEarned,
                        reason: `Focus Session: ${durationMinutes} min in ${payload.subject}`,
                        source: "focus_session",
                        dedupeKey: `focus_session:${req.user.id}:${session.id}`
                    }],
                    skipDuplicates: true
                });
                return { session };
            }, { isolationLevel: "Serializable" });
            if (result.conflict) {
                return res.status(409).json({ error: "Focus sessions cannot overlap" });
            }
            return res.status(result.duplicate ? 200 : 201).json({ session: result.session });
        } catch (error) {
            if (payload && error && ["P2002", "P2034"].includes(error.code)) {
                try {
                    const existing = await prisma.focusSession.findUnique({
                        where: { completionKey: payload.nonce },
                        select: FOCUS_SESSION_SELECT
                    });
                    if (existing && existing.userId === req.user.id) {
                        return res.status(200).json({ session: existing });
                    }
                } catch (lookupError) {
                    return next(lookupError);
                }
            }
            if (error && error.code === "P2002") {
                return res.status(409).json({ error: "Focus session has already been completed" });
            }
            if (error && error.code === "P2034") {
                return res.status(409).json({ error: "Focus session could not be completed concurrently" });
            }
            return next(error);
        }
    };
    router.post("/focus/sessions", completeFocusSession);
    router.post("/focus-sessions", completeFocusSession);

    router.get("/study-rooms", async (req, res, next) => {
        try {
            const rooms = await prisma.studyRoom.findMany({
                where: { OR: [{ isPrivate: false }, { ownerId: req.user.id }, { participants: { some: { userId: req.user.id } } }] },
                include: {
                    participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
                    messages: {
                        orderBy: { createdAt: "desc" },
                        take: 50,
                        include: { user: { select: { id: true, name: true, avatar: true } } }
                    }
                },
                orderBy: { createdAt: "desc" }
            });
            res.json({ rooms: rooms.map(serializeStudyRoom) });
        } catch (error) { next(error); }
    });

    router.post("/study-rooms", async (req, res, next) => {
        try {
            const allowed = new Set([
                "name", "topic", "isPrivate", "passcode", "maxParticipants",
                "focusDurationMinutes", "breakDurationMinutes"
            ]);
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => !allowed.has(field))) {
                return res.status(400).json({ error: "Study room fields are invalid" });
            }
            const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
            const topic = typeof req.body.topic === "string" ? req.body.topic.trim() : "";
            if (!name || name.length > 120 || !topic || topic.length > 160) {
                return res.status(400).json({ error: "Room name and topic must be within their length limits" });
            }
            if (req.body.isPrivate !== undefined && typeof req.body.isPrivate !== "boolean") {
                return res.status(400).json({ error: "isPrivate must be a boolean" });
            }
            const maxParticipants = req.body.maxParticipants === undefined
                ? 8
                : req.body.maxParticipants;
            const focusDurationMinutes = req.body.focusDurationMinutes === undefined
                ? 25
                : req.body.focusDurationMinutes;
            const breakDurationMinutes = req.body.breakDurationMinutes === undefined
                ? 5
                : req.body.breakDurationMinutes;
            if (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 100) {
                return res.status(400).json({ error: "Room capacity must be between 2 and 100" });
            }
            if (!Number.isInteger(focusDurationMinutes) ||
                focusDurationMinutes < 1 || focusDurationMinutes > 1440 ||
                !Number.isInteger(breakDurationMinutes) ||
                breakDurationMinutes < 1 || breakDurationMinutes > 1440) {
                return res.status(400).json({ error: "Focus and break durations must be positive minutes" });
            }
            const passcode = req.body.isPrivate
                ? (typeof req.body.passcode === "string" ? req.body.passcode : "")
                : null;
            if (req.body.isPrivate && (!passcode || passcode.length < 4 || passcode.length > 64)) {
                return res.status(400).json({ error: "Private rooms require a passcode from 4 to 64 characters" });
            }
            const room = await prisma.studyRoom.create({
                data: {
                    ownerId: req.user.id,
                    name,
                    topic,
                    isPrivate: req.body.isPrivate === true,
                    passcodeHash: passcode ? await bcrypt.hash(passcode, 10) : null,
                    maxParticipants,
                    focusDurationMinutes: focusDurationMinutes || 25,
                    breakDurationMinutes: breakDurationMinutes || 5,
                    participants: { create: { userId: req.user.id, status: "focusing" } }
                },
                include: {
                    participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
                    messages: { include: { user: { select: { id: true, name: true, avatar: true } } } }
                }
            });
            res.status(201).json({ room: serializeStudyRoom(room) });
        } catch (error) { next(error); }
    });

    router.post("/study-rooms/:id/join", async (req, res, next) => {
        if (!requireResourceId(req, res, "Study room")) return;
        try {
            if (
                !req.body ||
                typeof req.body !== "object" ||
                Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => field !== "passcode")
            ) {
                return res.status(400).json({ error: "Join request fields are invalid" });
            }
            if (Object.hasOwn(req.body, "passcode") &&
                (typeof req.body.passcode !== "string" || req.body.passcode.length > 64)) {
                return res.status(400).json({ error: "Room passcode must be at most 64 characters" });
            }
            const joined = await prisma.$transaction(async (tx) => {
                const room = await tx.studyRoom.findUnique({ where: { id: req.params.id } });
                if (!room) return { status: 404, error: "Study room not found" };
                if (room.isPrivate) {
                    if (typeof req.body.passcode !== "string" || !room.passcodeHash ||
                        !(await bcrypt.compare(req.body.passcode, room.passcodeHash))) {
                        return { status: 403, error: "Invalid room passcode" };
                    }
                }
                const existing = await tx.roomParticipant.findUnique({
                    where: { roomId_userId: { roomId: room.id, userId: req.user.id } }
                });
                if (!existing) {
                    const participantCount = await tx.roomParticipant.count({
                        where: { roomId: room.id }
                    });
                    if (participantCount >= room.maxParticipants) {
                        return { status: 409, error: "Study room is full" };
                    }
                }
                await tx.roomParticipant.upsert({
                    where: { roomId_userId: { roomId: room.id, userId: req.user.id } },
                    create: { roomId: room.id, userId: req.user.id, status: "focusing" },
                    update: { status: "focusing" }
                });
                return { status: 200, joined: true };
            }, { isolationLevel: "Serializable" });
            if (joined.error) return res.status(joined.status).json({ error: joined.error });
            broadcastRoom(req.params.id, { type: "room_presence" });
            res.json({ joined: true });
        } catch (error) {
            if (error && error.code === "P2034") {
                return res.status(409).json({ error: "Study room capacity changed; please retry joining" });
            }
            return next(error);
        }
    });

    router.patch("/study-rooms/:id", async (req, res, next) => {
        if (!requireResourceId(req, res, "Study room")) return;
        const allowed = new Set([
            "name", "topic", "maxParticipants", "focusDurationMinutes", "breakDurationMinutes"
        ]);
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
            Object.keys(req.body).length === 0 ||
            Object.keys(req.body).some((field) => !allowed.has(field))) {
            return res.status(400).json({ error: "Study room fields are invalid" });
        }

        const data = {};
        if (Object.hasOwn(req.body, "name")) {
            if (typeof req.body.name !== "string" || !req.body.name.trim() || req.body.name.trim().length > 120) {
                return res.status(400).json({ error: "Room name must be 1-120 characters" });
            }
            data.name = req.body.name.trim();
        }
        if (Object.hasOwn(req.body, "topic")) {
            if (typeof req.body.topic !== "string" || !req.body.topic.trim() || req.body.topic.trim().length > 160) {
                return res.status(400).json({ error: "Room topic must be 1-160 characters" });
            }
            data.topic = req.body.topic.trim();
        }
        for (const field of ["maxParticipants", "focusDurationMinutes", "breakDurationMinutes"]) {
            if (!Object.hasOwn(req.body, field)) continue;
            const value = req.body[field];
            const min = field === "maxParticipants" ? 2 : 1;
            const max = field === "maxParticipants" ? 100 : 1440;
            if (!Number.isInteger(value) || value < min || value > max) {
                return res.status(400).json({ error: `${field} is outside its allowed range` });
            }
            data[field] = value;
        }

        try {
            const room = await prisma.studyRoom.findUnique({ where: { id: req.params.id } });
            if (!room || room.ownerId !== req.user.id) {
                return res.status(404).json({ error: "Study room not found" });
            }
            if (data.maxParticipants !== undefined) {
                const participantCount = await prisma.roomParticipant.count({
                    where: { roomId: room.id }
                });
                if (data.maxParticipants < participantCount) {
                    return res.status(409).json({ error: "Room capacity cannot be below its current participant count" });
                }
            }
            await prisma.studyRoom.update({
                where: { id: room.id },
                data
            });
            broadcastRoom(room.id, { type: "room_updated" });
            return res.json({ updated: true });
        } catch (error) {
            return next(error);
        }
    });

    router.delete("/study-rooms/:id", async (req, res, next) => {
        if (!requireResourceId(req, res, "Study room")) return;
        try {
            const deleted = await prisma.studyRoom.deleteMany({
                where: { id: req.params.id, ownerId: req.user.id }
            });
            if (deleted.count === 0) return res.status(404).json({ error: "Study room not found" });
            broadcastRoom(req.params.id, { type: "room_deleted" });
            return res.status(204).end();
        } catch (error) {
            return next(error);
        }
    });

    router.delete("/study-rooms/:id/participants/me", async (req, res, next) => {
        if (!requireResourceId(req, res, "Study room")) return;
        try {
            const room = await prisma.studyRoom.findUnique({ where: { id: req.params.id } });
            if (!room) return res.status(404).json({ error: "Study room not found" });
            if (room.ownerId === req.user.id) {
                return res.status(409).json({ error: "Room owners must delete the room instead of leaving it" });
            }
            const result = await prisma.roomParticipant.deleteMany({
                where: { roomId: room.id, userId: req.user.id }
            });
            if (result.count === 0) return res.status(404).json({ error: "Room membership not found" });
            broadcastRoom(room.id, { type: "room_presence" });
            return res.status(204).end();
        } catch (error) {
            return next(error);
        }
    });

    router.patch("/study-rooms/:id/timer", async (req, res, next) => {
        if (!requireResourceId(req, res, "Study room")) return;
        const actions = new Set(["start", "pause", "reset", "next"]);
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
            Object.keys(req.body).length !== 1 || !actions.has(req.body.action)) {
            return res.status(400).json({ error: "Timer action is invalid" });
        }
        try {
            const room = await prisma.studyRoom.findUnique({ where: { id: req.params.id } });
            if (!room || room.ownerId !== req.user.id) {
                return res.status(404).json({ error: "Study room not found" });
            }

            const at = now();
            const data = {};
            if (req.body.action === "start") {
                if (!room.timerStartedAt) {
                    data.timerRemainingSeconds = getRoomRemainingSeconds(room, at) || (
                        (room.currentMode === "BREAK" ? room.breakDurationMinutes : room.focusDurationMinutes) * 60
                    );
                    data.timerStartedAt = at;
                }
            } else if (req.body.action === "pause") {
                data.timerRemainingSeconds = getRoomRemainingSeconds(room, at);
                data.timerStartedAt = null;
            } else if (req.body.action === "reset") {
                data.timerRemainingSeconds = (room.currentMode === "BREAK"
                    ? room.breakDurationMinutes
                    : room.focusDurationMinutes) * 60;
                data.timerStartedAt = null;
            } else {
                const currentMode = room.currentMode === "BREAK" ? "FOCUS" : "BREAK";
                data.currentMode = currentMode;
                data.timerRemainingSeconds = (currentMode === "BREAK"
                    ? room.breakDurationMinutes
                    : room.focusDurationMinutes) * 60;
                data.timerStartedAt = null;
            }

            const updated = Object.keys(data).length
                ? await prisma.studyRoom.update({ where: { id: room.id }, data })
                : room;
            const timer = {
                currentMode: updated.currentMode,
                timerRemainingSeconds: getRoomRemainingSeconds(updated, at),
                timerStartedAt: updated.timerStartedAt
            };
            broadcastRoom(room.id, { type: "room_timer", timer });
            return res.json({ timer });
        } catch (error) {
            return next(error);
        }
    });

    router.post("/study-rooms/:id/messages", async (req, res, next) => {
        if (!requireResourceId(req, res, "Study room")) return;
        try {
            if (
                !req.body ||
                typeof req.body !== "object" ||
                Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => field !== "content")
            ) {
                return res.status(400).json({ error: "Message fields are invalid" });
            }
            const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
            if (!content || content.length > 2000) {
                return res.status(400).json({ error: "Message content must be 1-2000 characters" });
            }
            const participant = await prisma.roomParticipant.findUnique({
                where: { roomId_userId: { roomId: req.params.id, userId: req.user.id } }
            });
            if (!participant) return res.status(403).json({ error: "Join the room before posting" });
            const message = await prisma.roomMessage.create({
                data: { roomId: req.params.id, userId: req.user.id, content }
            });
            broadcastRoom(req.params.id, { type: "room_message", message });
            res.status(201).json({ message });
        } catch (error) { next(error); }
    });

    router.get("/study-rooms/:id/events", async (req, res, next) => {
        if (!requireResourceId(req, res, "Study room")) return;
        try {
            const room = await prisma.studyRoom.findUnique({ where: { id: req.params.id } });
            if (!room) return res.status(404).json({ error: "Study room not found" });
            const participant = await prisma.roomParticipant.findUnique({
                where: { roomId_userId: { roomId: room.id, userId: req.user.id } }
            });
            if (!participant) return res.status(403).json({ error: "Join the room before subscribing" });

            res.status(200);
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders();
            res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

            if (!roomStreams.has(room.id)) roomStreams.set(room.id, new Set());
            roomStreams.get(room.id).add(res);
            const heartbeat = setInterval(() => {
                if (!res.destroyed) res.write(": heartbeat\n\n");
            }, 25000);
            if (typeof heartbeat.unref === "function") heartbeat.unref();
            req.on("close", () => {
                clearInterval(heartbeat);
                const streams = roomStreams.get(room.id);
                if (!streams) return;
                streams.delete(res);
                if (streams.size === 0) roomStreams.delete(room.id);
            });
        } catch (error) { next(error); }
    });

    router.get("/gamification", async (req, res, next) => {
        try {
            const [transactions, achievements, focusCount, completedTaskCount, habitCheckIns, roomCount, xpAggregate] = await Promise.all([
                prisma.xPTransaction.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
                prisma.achievement.findMany({ include: { users: { where: { userId: req.user.id } } } }),
                prisma.focusSession.count({ where: { userId: req.user.id } }),
                prisma.task.count({ where: { userId: req.user.id, status: "COMPLETED" } }),
                prisma.habitCheckIn.findMany({ where: { userId: req.user.id }, orderBy: { date: "asc" }, select: { habitId: true, date: true } }),
                prisma.roomParticipant.count({ where: { userId: req.user.id } }),
                prisma.xPTransaction.aggregate({ where: { userId: req.user.id }, _sum: { amount: true } })
            ]);
            const metrics = {
                focusCount,
                completedTaskCount,
                longestHabitStreak: longestHabitStreak(habitCheckIns),
                roomCount
            };
            for (const achievement of achievements) {
                const progress = getAchievementProgress(achievement, metrics);
                await prisma.$transaction(async (tx) => {
                    const existing = achievement.users[0];
                    const shouldUnlock = progress >= achievement.requirement;
                    await tx.userAchievement.upsert({
                        where: { userId_achievementId: { userId: req.user.id, achievementId: achievement.id } },
                        create: {
                            userId: req.user.id,
                            achievementId: achievement.id,
                            progress,
                            unlockedAt: shouldUnlock ? new Date() : null
                        },
                        update: {
                            progress,
                            unlockedAt: shouldUnlock
                                ? existing?.unlockedAt || new Date()
                                : null
                        }
                    });
                    if (shouldUnlock && !existing?.unlockedAt) {
                        await tx.xPTransaction.createMany({
                            data: [{
                                userId: req.user.id,
                                amount: achievement.xpReward,
                                reason: `Achievement unlocked: ${achievement.title}`,
                                source: "achievement",
                                dedupeKey: `achievement:${req.user.id}:${achievement.id}`
                            }],
                            skipDuplicates: true
                        });
                    }
                });
            }
            const updatedAchievements = await prisma.userAchievement.findMany({
                where: { userId: req.user.id },
                include: { achievement: true },
                orderBy: { unlockedAt: "desc" }
            });
            const xpTotal = xpAggregate._sum.amount || 0;
            const level = Math.max(1, Math.floor(xpTotal / 500) + 1);
            res.json({ transactions, achievements: updatedAchievements, xpTotal, level });
        } catch (error) { next(error); }
    });


    router.get("/analytics", async (req, res, next) => {
        try {
            const unsupportedQuery = Object.keys(req.query).find((field) => field !== "period");
            if (unsupportedQuery) {
                return res.status(400).json({ error: `Unsupported query parameter: ${unsupportedQuery}` });
            }
            if (Object.hasOwn(req.query, "period") && typeof req.query.period !== "string") {
                return res.status(400).json({ error: "Invalid analytics period" });
            }
            const period = typeof req.query.period === "string" ? req.query.period : "7d";
            if (!["7d", "30d", "semester"].includes(period)) {
                return res.status(400).json({ error: "Invalid analytics period" });
            }
            const now = new Date();
            const periodDays = period === "semester" ? 120 : period === "30d" ? 30 : 7;
            const from = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
            const [tasks, sessions, habits, notes, xp] = await Promise.all([
                prisma.task.findMany({ where: { userId: req.user.id, OR: [{ createdAt: { gte: from } }, { status: "COMPLETED", updatedAt: { gte: from } }] }, select: { status: true, dueDate: true, updatedAt: true } }),
                prisma.focusSession.findMany({ where: { userId: req.user.id, completedAt: { gte: from } }, select: { durationMinutes: true, completedAt: true, subject: true } }),
                prisma.habit.findMany({
                    where: { userId: req.user.id },
                    include: { checkIns: { where: { date: { gte: from } } } }
                }),
                prisma.studyNote.count({ where: { userId: req.user.id } }),
                prisma.xPTransaction.aggregate({
                    where: { userId: req.user.id, createdAt: { gte: from } },
                    _sum: { amount: true }
                })
            ]);
            const focusByDay = {};
            for (const session of sessions) {
                const key = session.completedAt.toISOString().slice(0, 10);
                focusByDay[key] = (focusByDay[key] || 0) + session.durationMinutes;
            }
            const subjectDistribution = {};
            for (const session of sessions) {
                subjectDistribution[session.subject] = (subjectDistribution[session.subject] || 0) + session.durationMinutes;
            }
            res.json({
                analytics: {
                    taskCounts: Object.fromEntries(["TODO", "IN_PROGRESS", "COMPLETED"].map((status) => [status, tasks.filter((task) => task.status === status).length])),
                    focusMinutes: sessions.reduce((sum, session) => sum + session.durationMinutes, 0),
                    xpEarned: xp._sum.amount || 0,
                    habitCheckIns: habits.reduce((sum, habit) => sum + habit.checkIns.length, 0),
                    noteCount: notes,
                    focusByDay,
                    subjectDistribution
                }
            });
        } catch (error) { next(error); }
    });

    router.get("/admin/stats", async (req, res, next) => {
        try {
            const actor = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
            if (!actor || actor.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const [totalUsers, totalTasksCompleted, totalStudyHours, reportedContentCount, activeUsers] = await Promise.all([
                prisma.user.count(),
                prisma.task.count({ where: { status: "COMPLETED" } }),
                prisma.focusSession.aggregate({ _sum: { durationMinutes: true } }),
                prisma.moderationReport.count({ where: { status: "PENDING" } }),
                prisma.focusSession.findMany({
                    where: { completedAt: { gte: todayStart } },
                    select: { userId: true },
                    distinct: ["userId"]
                })
            ]);
            res.json({ stats: {
                totalUsers,
                activeUsersToday: activeUsers.length,
                totalStudyHours: Math.round((totalStudyHours._sum.durationMinutes || 0) / 60),
                totalTasksCompleted,
                reportedContentCount
            } });
        } catch (error) { next(error); }
    });

    async function requireAdmin(req, res) {
        const actor = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { role: true }
        });
        if (!actor || actor.role !== "ADMIN") {
            res.status(403).json({ error: "Admin access required" });
            return false;
        }
        return true;
    }

    router.post("/reports", async (req, res, next) => {
        try {
            const allowed = new Set(["targetType", "targetId", "reason", "contentSnippet"]);
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => !allowed.has(field))) {
                return res.status(400).json({ error: "Valid report fields are required" });
            }
            const targetType = typeof req.body.targetType === "string" ? req.body.targetType.toUpperCase() : "";
            const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
            const contentSnippet = typeof req.body.contentSnippet === "string" ? req.body.contentSnippet.trim() : "";
            if (!["NOTE", "ROOM_MESSAGE", "USER"].includes(targetType) ||
                !reason || reason.length > 500 ||
                !contentSnippet || contentSnippet.length > 2000 ||
                !isValidUuid(req.body.targetId)) {
                return res.status(400).json({ error: "Valid report fields are required" });
            }
            const targetExists =
                targetType === "NOTE"
                    ? await prisma.studyNote.findUnique({ where: { id: req.body.targetId } })
                    : targetType === "ROOM_MESSAGE"
                        ? await prisma.roomMessage.findUnique({ where: { id: req.body.targetId } })
                        : await prisma.user.findUnique({ where: { id: req.body.targetId } });
            if (!targetExists) return res.status(404).json({ error: "Moderation target not found" });
            const duplicate = await prisma.moderationReport.findFirst({
                where: {
                    reporterId: req.user.id,
                    targetType,
                    targetId: req.body.targetId,
                    status: "PENDING"
                }
            });
            if (duplicate) return res.status(409).json({ error: "A pending report already exists for this target" });
            const report = await prisma.$transaction(async (transaction) => {
                const created = await transaction.moderationReport.create({
                    data: {
                        reporterId: req.user.id,
                        targetType,
                        targetId: req.body.targetId,
                        reason,
                        contentSnippet
                    }
                });
                await transaction.auditLog.create({
                    data: {
                        actorId: req.user.id,
                        action: "MODERATION_REPORT_CREATED",
                        target: created.id,
                        ipAddress: req.ip || null,
                        details: { targetType, targetId: req.body.targetId }
                    }
                });
                return created;
            });
            res.status(201).json({ report });
        } catch (error) { next(error); }
    });

    router.get("/admin/reports", async (req, res, next) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const reports = await prisma.moderationReport.findMany({
                orderBy: [{ status: "asc" }, { createdAt: "desc" }],
                take: 100,
                include: { reporter: { select: { id: true, name: true, email: true } } }
            });
            res.json({ reports });
        } catch (error) { next(error); }
    });

    router.patch("/admin/reports/:id", async (req, res, next) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            if (!isValidUuid(req.params.id)) {
                return res.status(400).json({ error: "Invalid moderation report ID" });
            }
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
                Object.keys(req.body).length !== 1 || Object.keys(req.body)[0] !== "status") {
                return res.status(400).json({ error: "Status must be RESOLVED or DISMISSED" });
            }
            if (!["RESOLVED", "DISMISSED"].includes(req.body.status)) {
                return res.status(400).json({ error: "Status must be RESOLVED or DISMISSED" });
            }
            const existing = await prisma.moderationReport.findUnique({ where: { id: req.params.id } });
            if (!existing) return res.status(404).json({ error: "Moderation report not found" });
            if (existing.status !== "PENDING") {
                return res.status(409).json({ error: "This moderation report has already been resolved" });
            }
            const report = await prisma.$transaction(async (transaction) => {
                const changed = await transaction.moderationReport.updateMany({
                    where: { id: existing.id, status: "PENDING" },
                    data: {
                        status: req.body.status,
                        resolvedById: req.user.id,
                        resolvedAt: new Date()
                    }
                });
                if (changed.count !== 1) {
                    return null;
                }
                const updated = await transaction.moderationReport.findUnique({
                    where: { id: existing.id }
                });
                await transaction.auditLog.create({
                    data: {
                        actorId: req.user.id,
                        action: `MODERATION_REPORT_${req.body.status}`,
                        target: updated.id,
                        ipAddress: req.ip || null,
                        details: { previousStatus: existing.status, status: req.body.status }
                    }
                });
                return updated;
            });
            if (!report) {
                return res.status(409).json({ error: "This moderation report has already been resolved" });
            }
            res.json({ report });
        } catch (error) { next(error); }
    });

    router.get("/admin/audit-logs", async (req, res, next) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const logs = await prisma.auditLog.findMany({
                orderBy: { createdAt: "desc" },
                take: 200,
                include: { actor: { select: { id: true, name: true, email: true } } }
            });
            res.json({ logs });
        } catch (error) { next(error); }
    });

    router.get("/search", async (req, res, next) => {
        try {
            const unsupportedQuery = Object.keys(req.query).find((field) => field !== "q");
            if (unsupportedQuery) {
                return res.status(400).json({ error: `Unsupported query parameter: ${unsupportedQuery}` });
            }
            if (Object.hasOwn(req.query, "q") && typeof req.query.q !== "string") {
                return res.status(400).json({ error: "Search query is invalid" });
            }
            const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
            if (query.length > 200) return res.status(400).json({ error: "Search query is too long" });
            if (!query) return res.json({ tasks: [], notes: [], habits: [] });
            const [tasks, notes, habits] = await Promise.all([
                prisma.task.findMany({ where: { userId: req.user.id, OR: [{ title: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] }, take: 50 }),
                prisma.studyNote.findMany({ where: { userId: req.user.id, OR: [{ title: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }] }, take: 50 }),
                prisma.habit.findMany({ where: { userId: req.user.id, OR: [{ title: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] }, take: 50 })
            ]);
            res.json({ tasks, notes, habits });
        } catch (error) { next(error); }
    });

    return router;
}

module.exports = createProductRouter;
