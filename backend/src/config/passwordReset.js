"use strict";

const DEFAULT_TOKEN_TTL_MINUTES = 30;
const MAX_TOKEN_TTL_MINUTES = 24 * 60;

function getPasswordResetTokenTtlMs(env = process.env) {
    const configuredMinutes = env.PASSWORD_RESET_TOKEN_TTL_MINUTES;
    if (configuredMinutes === undefined || configuredMinutes === "") {
        return DEFAULT_TOKEN_TTL_MINUTES * 60 * 1000;
    }

    const value = typeof configuredMinutes === "string" ? configuredMinutes.trim() : "";
    const minutes = /^\d+$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > MAX_TOKEN_TTL_MINUTES) {
        throw new Error("PASSWORD_RESET_TOKEN_TTL_MINUTES must be an integer from 1 to 1440");
    }

    return minutes * 60 * 1000;
}

module.exports = { getPasswordResetTokenTtlMs };
