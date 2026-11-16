const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require("../config/auth");
const authenticateToken = require("../middleware/authenticateToken");

const SAFE_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    updatedAt: true
};
const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
const REGISTRATION_RESPONSE = {
    message: "If registration can be completed, you can now sign in."
};

function normalizeEmail(value) {
    return value.trim().toLowerCase();
}

function isValidEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCredentials(body, includeName = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "A JSON object is required" };
    }

    if (includeName && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100)) {
        return { error: "Name is required and must be 100 characters or fewer" };
    }

    if (typeof body.email !== "string" || !body.email.trim()) {
        return { error: "Email is required" };
    }

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
        return { error: "A valid email is required" };
    }

    if (typeof body.password !== "string" || !body.password) {
        return { error: "Password is required" };
    }

    const passwordBytes = Buffer.byteLength(body.password, "utf8");
    if (passwordBytes < 8 || passwordBytes > 72) {
        return { error: "Password must be between 8 and 72 bytes" };
    }

    return { email };
}

function createAuthRouter(prisma) {
    const router = express.Router();
    const authRateLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Too many authentication attempts. Please try again later." }
    });

    router.post("/register", authRateLimit, async (req, res, next) => {
        const validation = validateCredentials(req.body, true);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        try {
            const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
            await prisma.user.create({
                data: {
                    name: req.body.name.trim(),
                    email: validation.email,
                    password: passwordHash
                },
                select: SAFE_USER_SELECT
            });

            return res.status(202).json(REGISTRATION_RESPONSE);
        } catch (error) {
            if (error && error.code === "P2002") {
                return res.status(202).json(REGISTRATION_RESPONSE);
            }

            return next(error);
        }
    });

    router.post("/login", authRateLimit, async (req, res, next) => {
        const validation = validateCredentials(req.body);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        try {
            const user = await prisma.user.findUnique({
                where: { email: validation.email },
                select: { ...SAFE_USER_SELECT, password: true }
            });

            const passwordMatches = await bcrypt.compare(
                req.body.password,
                user ? user.password : DUMMY_PASSWORD_HASH
            );
            if (!user || !passwordMatches) {
                return res.status(401).json({ error: "Invalid email or password" });
            }

            const token = jwt.sign({}, getJwtSecret(), {
                algorithm: "HS256",
                audience: JWT_AUDIENCE,
                expiresIn: "1h",
                issuer: JWT_ISSUER,
                subject: user.id
            });

            const { password, ...safeUser } = user;
            return res.json({ token, user: safeUser });
        } catch (error) {
            return next(error);
        }
    });

    router.get("/me", authenticateToken, async (req, res, next) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: SAFE_USER_SELECT
            });

            if (!user) {
                return res.status(401).json({ error: "Invalid or expired token" });
            }

            return res.json({ user });
        } catch (error) {
            return next(error);
        }
    });

    return router;
}

module.exports = createAuthRouter;
