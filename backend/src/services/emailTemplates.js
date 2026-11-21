"use strict";

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

function createPasswordResetEmailTemplate({ resetUrl, expiresAt, fromName = "Taskora" }) {
    if (typeof resetUrl !== "string" || !resetUrl || !(expiresAt instanceof Date) ||
        Number.isNaN(expiresAt.getTime())) {
        throw new TypeError("Password reset email requires a URL and valid expiry date");
    }

    const safeResetUrl = escapeHtml(resetUrl);
    const safeFromName = escapeHtml(fromName);
    const expiry = expiresAt.toISOString();
    return {
        subject: "Reset your Taskora password",
        text: [
            `We received a request to reset your ${fromName} password.`,
            `Use this link to choose a new password: ${resetUrl}`,
            `This link expires at ${expiry}. If you did not request a reset, you can ignore this email.`
        ].join("\n\n"),
        html: [
            "<!doctype html><html><body>",
            `<p>We received a request to reset your ${safeFromName} password.</p>`,
            `<p><a href="${safeResetUrl}">Choose a new password</a></p>`,
            `<p>This link expires at ${escapeHtml(expiry)}. If you did not request a reset, you can ignore this email.</p>`,
            "</body></html>"
        ].join("")
    };
}

module.exports = { createPasswordResetEmailTemplate };
