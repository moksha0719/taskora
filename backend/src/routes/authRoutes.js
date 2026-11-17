const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require("../config/auth");
const authenticateToken = require("../middleware/authenticateToken");
const { validateCredentials } = require("../validators/authValidators");

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
                    name: validation.data.name,
                    email: validation.data.email,
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
                where: { email: validation.data.email },
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
