const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require("../config/auth");
const { getPasswordResetTokenTtlMs } = require("../config/passwordReset");
const authenticateToken = require("../middleware/authenticateToken");
const { validateCredentials } = require("../validators/authValidators");
const { createPasswordResetDeliveryService } = require("../services/passwordResetDeliveryService");
const { createProfilePhotoStorage, identifyImageType } = require("../services/profilePhotoStorage");
const logSafeError = require("../lib/logSafeError");

const SAFE_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    avatar: true,
    bio: true,
    major: true,
    createdAt: true,
    updatedAt: true
};
const BCRYPT_ROUNDS = 12;
const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PROFILE_FIELD_MAX_LENGTHS = {
    name: 100,
    avatar: 2048,
    bio: 1000,
    major: 120
};
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
const REGISTRATION_RESPONSE = {
    message: "If registration can be completed, you can now sign in."
};
const DELIVERY_REASON_CODES = {
    "mock-transport": "MOCK_TRANSPORT",
    "delivery-provider-unavailable": "PROVIDER_UNAVAILABLE",
    "delivery-provider-rejected": "PROVIDER_REJECTED",
    "delivery-provider-timeout": "PROVIDER_TIMEOUT",
    "delivery-provider-error": "PROVIDER_ERROR"
};

function createAuthRouter(
    prisma,
    passwordResetDelivery = createPasswordResetDeliveryService(),
    profilePhotoStorage = createProfilePhotoStorage()
) {
    const router = express.Router();
    const passwordResetTokenTtlMs = getPasswordResetTokenTtlMs();
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

    router.patch("/profile", authenticateToken, async (req, res, next) => {
        try {
            const allowed = ["name", "avatar", "bio", "major"];
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
                return res.status(400).json({ error: "A JSON object is required" });
            }
            const unsupported = Object.keys(req.body || {}).filter((field) => !allowed.includes(field));
            if (unsupported.length) return res.status(400).json({ error: `Unsupported profile field: ${unsupported[0]}` });
            const data = {};
            for (const field of ["avatar", "bio", "major"]) {
                if (!Object.hasOwn(req.body, field)) continue;
                const value = req.body[field];
                if (value !== null && typeof value !== "string") {
                    return res.status(400).json({ error: `${field} must be a string or null` });
                }
                if (typeof value === "string" && value.length > PROFILE_FIELD_MAX_LENGTHS[field]) {
                    return res.status(400).json({
                        error: `${field} must be ${PROFILE_FIELD_MAX_LENGTHS[field]} characters or fewer`
                    });
                }
                data[field] = typeof value === "string" ? value.trim() || null : null;
            }
            if (Object.hasOwn(req.body, "name")) {
                if (
                    typeof req.body.name !== "string" ||
                    !req.body.name.trim() ||
                    req.body.name.trim().length > PROFILE_FIELD_MAX_LENGTHS.name
                ) {
                    return res.status(400).json({
                        error: `name must be 1-${PROFILE_FIELD_MAX_LENGTHS.name} characters`
                    });
                }
                data.name = req.body.name.trim();
            }
            if (Object.keys(data).length === 0) return res.status(400).json({ error: "At least one profile field is required" });
            const user = await prisma.user.update({
                where: { id: req.user.id },
                data,
                select: SAFE_USER_SELECT
            });
            return res.json({ user });
        } catch (error) { return next(error); }
    });

    router.put(
        "/profile/avatar",
        authenticateToken,
        express.raw({ type: PROFILE_PHOTO_TYPES, limit: PROFILE_PHOTO_MAX_BYTES }),
        async (req, res, next) => {
            const contentType = (req.get("content-type") || "").split(";")[0].trim().toLowerCase();
            if (!PROFILE_PHOTO_TYPES.includes(contentType)) {
                return res.status(415).json({ error: "Profile photo must be a JPEG, PNG, or WebP image" });
            }
            if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
                return res.status(400).json({ error: "A non-empty profile photo is required" });
            }
            if (identifyImageType(req.body) !== contentType) {
                return res.status(400).json({ error: "Profile photo content does not match its file type" });
            }

            try {
                const existingUser = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { id: true, avatar: true }
                });
                if (!existingUser) {
                    return res.status(404).json({ error: "User not found" });
                }

                const uploadedPhoto = await profilePhotoStorage.save(
                    req.user.id,
                    req.body,
                    contentType
                );
                let user;
                try {
                    user = await prisma.user.update({
                        where: { id: req.user.id },
                        data: { avatar: uploadedPhoto.url },
                        select: SAFE_USER_SELECT
                    });
                } catch (error) {
                    await profilePhotoStorage.removeOwnedPhoto(req.user.id, uploadedPhoto.url)
                        .catch((cleanupError) => logSafeError(
                            "Failed to clean up an unreferenced profile photo:",
                            cleanupError
                        ));
                    throw error;
                }

                if (existingUser.avatar && existingUser.avatar !== uploadedPhoto.url) {
                    await profilePhotoStorage.removeOwnedPhoto(req.user.id, existingUser.avatar)
                        .catch((cleanupError) => logSafeError(
                            "Failed to clean up a replaced profile photo:",
                            cleanupError
                        ));
                }
                return res.json({ user });
            } catch (error) {
                return next(error);
            }
        }
    );

    router.patch("/password", authenticateToken, async (req, res, next) => {
        try {
            if (
                !req.body ||
                typeof req.body !== "object" ||
                Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => !["currentPassword", "newPassword"].includes(field))
            ) {
                return res.status(400).json({ error: "Only currentPassword and newPassword are accepted" });
            }
            const currentPassword = typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
            const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
            const currentPasswordBytes = Buffer.byteLength(currentPassword, "utf8");
            const newPasswordBytes = Buffer.byteLength(newPassword, "utf8");
            if (currentPasswordBytes < 1 || currentPasswordBytes > 72 ||
                newPasswordBytes < 8 || newPasswordBytes > 72) {
                return res.status(400).json({ error: "Current password and a valid new password are required" });
            }
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { password: true }
            });
            if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
                return res.status(401).json({ error: "Invalid current password" });
            }
            await prisma.user.update({
                where: { id: req.user.id },
                data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) }
            });
            return res.json({ message: "Password changed successfully" });
        } catch (error) { return next(error); }
    });

    router.delete("/account", authenticateToken, async (req, res, next) => {
        try {
            await prisma.user.delete({ where: { id: req.user.id } });
            return res.status(204).end();
        } catch (error) { return next(error); }
    });

    router.post("/forgot-password", authRateLimit, async (req, res, next) => {
        try {
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => field !== "email")) {
                return res.status(400).json({ error: "Only the email field is accepted" });
            }
            const email = typeof req.body.email === "string"
                ? req.body.email.trim().toLowerCase()
                : "";
            if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: "A valid email is required" });
            }
            const user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                const token = crypto.randomBytes(32).toString("hex");
                const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
                await prisma.passwordResetToken.updateMany({
                    where: { userId: user.id, usedAt: null },
                    data: { usedAt: new Date() }
                });
                const expiresAt = new Date(Date.now() + passwordResetTokenTtlMs);
                await prisma.passwordResetToken.create({
                    data: { userId: user.id, tokenHash, expiresAt }
                });
                try {
                    const delivery = await passwordResetDelivery.sendResetLink({
                        email: user.email,
                        token,
                        expiresAt
                    });
                    if (!delivery || !delivery.delivered) {
                        logSafeError("Password reset delivery was not completed:", {
                            name: "PasswordResetDeliveryError",
                            code: DELIVERY_REASON_CODES[delivery && delivery.reason] || "DELIVERY_INCOMPLETE"
                        });
                    }
                } catch (error) {
                    logSafeError("Password reset delivery failed:", error);
                }
            }
            return res.status(202).json({
                message: "If an account exists for that email, password reset instructions will be sent if email delivery is configured."
            });
        } catch (error) { return next(error); }
    });

    router.post("/reset-password", authRateLimit, async (req, res, next) => {
        try {
            if (
                !req.body ||
                typeof req.body !== "object" ||
                Array.isArray(req.body) ||
                Object.keys(req.body).some((field) => !["token", "password"].includes(field))
            ) {
                return res.status(400).json({ error: "Only token and password are accepted" });
            }
            const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
            const newPassword = typeof req.body.password === "string" ? req.body.password : "";
            if (!/^[a-f0-9]{64}$/.test(token)) {
                return res.status(400).json({ error: "A valid reset token is required" });
            }
            const newPasswordBytes = Buffer.byteLength(newPassword, "utf8");
            if (newPasswordBytes < 8 || newPasswordBytes > 72) {
                return res.status(400).json({ error: "Password must be 8 to 72 UTF-8 bytes" });
            }
            const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
            const now = new Date();
            const reset = await prisma.passwordResetToken.findFirst({
                where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
                include: { user: true }
            });
            if (!reset) return res.status(400).json({ error: "Reset token is invalid or expired" });

            await prisma.$transaction(async (tx) => {
                const claimed = await tx.passwordResetToken.updateMany({
                    where: {
                        id: reset.id,
                        tokenHash,
                        usedAt: null,
                        expiresAt: { gt: now }
                    },
                    data: { usedAt: now }
                });
                if (claimed.count !== 1) {
                    throw new Error("RESET_TOKEN_CLAIM_LOST");
                }
                await tx.user.update({
                    where: { id: reset.userId },
                    data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) }
                });
            });
            return res.json({ message: "Password reset successfully" });
        } catch (error) {
            if (error && error.message === "RESET_TOKEN_CLAIM_LOST") {
                return res.status(400).json({ error: "Reset token is invalid or expired" });
            }
            return next(error);
        }
    });

    return router;
}

module.exports = createAuthRouter;
