"use strict";

const crypto = require("node:crypto");
const { getEmailConfig } = require("../config/email");
const { createPasswordResetEmailTemplate } = require("./emailTemplates");

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

function formatSender(name, address) {
    const escapedName = name.replace(/(["\\])/g, "\\$1");
    return `"${escapedName}" <${address}>`;
}

function createPasswordResetDeliveryService({
    env = process.env,
    fetchFunction = globalThis.fetch
} = {}) {
    const config = getEmailConfig(env);

    async function post(url, headers, body) {
        if (typeof fetchFunction !== "function") {
            return { delivered: false, reason: "delivery-provider-unavailable" };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
            const response = await fetchFunction(url, {
                method: "POST",
                headers,
                body,
                signal: controller.signal
            });
            return response.ok
                ? { delivered: true }
                : { delivered: false, reason: "delivery-provider-rejected" };
        } catch {
            return {
                delivered: false,
                reason: controller.signal.aborted
                    ? "delivery-provider-timeout"
                    : "delivery-provider-error"
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    async function sendResetLink({ email, token, expiresAt }) {
        if (config.provider === "mock") {
            return { delivered: false, reason: "mock-transport" };
        }

        let resetUrl;
        if (config.passwordResetUrl) {
            const url = new URL(config.passwordResetUrl);
            url.searchParams.set("token", token);
            resetUrl = url.toString();
        }
        const template = resetUrl
            ? createPasswordResetEmailTemplate({
                resetUrl,
                expiresAt,
                fromName: config.fromName || "Taskora"
            })
            : null;

        if (config.provider === "resend") {
            const body = JSON.stringify({
                from: formatSender(config.fromName, config.from),
                to: [email],
                ...template
            });
            return post(RESEND_EMAILS_URL, {
                authorization: `Bearer ${config.apiKey}`,
                "content-type": "application/json"
            }, body);
        }

        const payload = {
            email,
            token,
            expiresAt: expiresAt.toISOString(),
            ...(resetUrl ? { resetUrl } : {}),
            ...(template ? {
                ...template,
                ...(config.from ? { from: formatSender(config.fromName, config.from) } : {})
            } : {})
        };
        const serializedPayload = JSON.stringify(payload);
        const headers = { "content-type": "application/json" };
        if (config.authorization) {
            headers.authorization = config.authorization;
        }
        if (config.signingSecret) {
            const timestamp = String(Date.now());
            headers["x-taskora-signature"] = crypto.createHmac(
                "sha256",
                config.signingSecret
            ).update(`${timestamp}.${serializedPayload}`).digest("hex");
            headers["x-taskora-timestamp"] = timestamp;
        }
        return post(config.deliveryUrl, headers, serializedPayload);
    }

    return { sendResetLink, provider: config.provider };
}

module.exports = {
    createPasswordResetDeliveryService
};
