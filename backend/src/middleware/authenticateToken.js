const jwt = require("jsonwebtoken");
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require("../config/auth");

function authenticateToken(req, res, next) {
    const authorization = req.get("authorization");
    const match = typeof authorization === "string"
        ? authorization.match(/^Bearer\s+(\S+)$/i)
        : null;

    if (!match) {
        return res.status(401).json({ error: "Authentication required" });
    }

    let secret;
    try {
        secret = getJwtSecret();
    } catch (error) {
        return next(error);
    }

    try {
        const payload = jwt.verify(match[1], secret, {
            algorithms: ["HS256"],
            audience: JWT_AUDIENCE,
            issuer: JWT_ISSUER
        });

        if (typeof payload === "string" || typeof payload.sub !== "string") {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        req.user = { id: payload.sub };
        return next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

module.exports = authenticateToken;
