const JWT_ISSUER = "taskora-api";
const JWT_AUDIENCE = "taskora-client";

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
        throw new Error("JWT_SECRET must be configured with at least 32 bytes");
    }

    return secret;
}

module.exports = { JWT_ISSUER, JWT_AUDIENCE, getJwtSecret };
