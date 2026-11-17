function parseAllowedOrigins(value) {
    if (value === undefined) {
        return new Set();
    }
    if (typeof value !== "string") {
        throw new Error("CORS_ALLOWED_ORIGINS must be a comma-separated origin list");
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return new Set();
    }

    const entries = trimmed.split(",").map((origin) => origin.trim());
    if (entries.some((origin) => !origin)) {
        throw new Error("CORS_ALLOWED_ORIGINS contains an empty origin");
    }

    for (const origin of entries) {
        let parsed;
        try {
            parsed = new URL(origin);
        } catch {
            throw new Error("CORS_ALLOWED_ORIGINS must contain valid HTTP(S) origins");
        }

        if (
            !["http:", "https:"].includes(parsed.protocol) ||
            parsed.origin !== origin ||
            parsed.pathname !== "/" ||
            parsed.search ||
            parsed.hash
        ) {
            throw new Error("CORS_ALLOWED_ORIGINS must contain exact origins without paths");
        }
    }

    return new Set(entries);
}

function createCorsPolicy(env = process.env) {
    const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
    const allowAnyOrigin = env.NODE_ENV !== "production" &&
        (!env.CORS_ALLOWED_ORIGINS || !env.CORS_ALLOWED_ORIGINS.trim());

    function isAllowedOrigin(origin) {
        return !origin || allowAnyOrigin || allowedOrigins.has(origin);
    }

    function rejectUnapprovedOrigin(req, res, next) {
        const origin = req.get("origin");
        if (origin && !isAllowedOrigin(origin)) {
            return res.status(403).json({ error: "Origin not allowed" });
        }
        return next();
    }

    function corsOrigin(origin, callback) {
        return callback(null, Boolean(origin) && isAllowedOrigin(origin));
    }

    return { corsOrigin, rejectUnapprovedOrigin };
}

module.exports = { createCorsPolicy, parseAllowedOrigins };
