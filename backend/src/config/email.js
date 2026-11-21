"use strict";

const EMAIL_PROVIDERS = new Set(["mock", "resend", "webhook"]);

function requiredValue(env, name) {
    const value = env[name];
    if (typeof value !== "string" || !value.trim() || value.trim().toLowerCase().startsWith("replace_with_")) {
        throw new Error(`${name} is required for the selected email provider`);
    }
    if (/[\u0000-\u001f\u007f]/.test(value)) {
        throw new Error(`${name} must not contain control characters`);
    }
    return value.trim();
}

function optionalValue(env, name) {
    const value = env[name];
    if (value === undefined || value === "") {
        return "";
    }
    if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) {
        throw new Error(`${name} must be a string without control characters`);
    }
    return value.trim();
}

function validateUrl(value, name, production) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${name} must be a valid HTTP(S) URL`);
    }
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`${name} must be a valid HTTP(S) URL`);
    }
    if (url.username || url.password) {
        throw new Error(`${name} must not contain embedded credentials`);
    }
    if (production && url.protocol !== "https:") {
        throw new Error(`${name} must use HTTPS in production`);
    }
    return url.toString();
}

function validateEmailAddress(value, name) {
    const address = requiredValue({ [name]: value }, name);
    if (
        address.length > 254 ||
        !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) ||
        /[\r\n]/.test(address)
    ) {
        throw new Error(`${name} must be a valid email address`);
    }
    return address;
}

function getEmailConfig(env = process.env) {
    const production = env.NODE_ENV === "production";
    const configuredProvider = typeof env.EMAIL_PROVIDER === "string"
        ? env.EMAIL_PROVIDER.trim().toLowerCase()
        : "";
    const provider = configuredProvider ||
        (env.PASSWORD_RESET_DELIVERY_URL ? "webhook" : production ? "" : "mock");

    if (!provider) {
        throw new Error("EMAIL_PROVIDER must be configured in production");
    }
    if (!EMAIL_PROVIDERS.has(provider)) {
        throw new Error("EMAIL_PROVIDER must be mock, resend, or webhook");
    }
    if (production && provider === "mock") {
        throw new Error("EMAIL_PROVIDER=mock is not allowed in production");
    }

    const timeoutValue = env.EMAIL_DELIVERY_TIMEOUT_MS === undefined
        ? env.PASSWORD_RESET_DELIVERY_TIMEOUT_MS
        : env.EMAIL_DELIVERY_TIMEOUT_MS;
    const timeoutMs = timeoutValue === undefined || timeoutValue === ""
        ? 5000
        : Number(timeoutValue);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
        throw new Error("EMAIL_DELIVERY_TIMEOUT_MS must be an integer from 1 to 60000");
    }

    const config = { provider, production, timeoutMs };
    if (provider === "resend") {
        config.apiKey = requiredValue(env, "EMAIL_API_KEY");
        config.from = validateEmailAddress(env.EMAIL_FROM, "EMAIL_FROM");
        config.fromName = requiredValue(env, "EMAIL_FROM_NAME");
        if (config.fromName.length > 100) {
            throw new Error("EMAIL_FROM_NAME must be at most 100 characters and contain no line breaks");
        }
        config.passwordResetUrl = validateUrl(
            requiredValue(env, "PASSWORD_RESET_URL"),
            "PASSWORD_RESET_URL",
            production
        );
    } else if (provider === "webhook") {
        config.deliveryUrl = validateUrl(
            requiredValue(env, "PASSWORD_RESET_DELIVERY_URL"),
            "PASSWORD_RESET_DELIVERY_URL",
            production
        );
        config.authorization = optionalValue(env, "PASSWORD_RESET_DELIVERY_AUTHORIZATION");
        config.signingSecret = optionalValue(env, "PASSWORD_RESET_DELIVERY_SIGNING_SECRET");
        if (env.PASSWORD_RESET_URL) {
            config.passwordResetUrl = validateUrl(
                env.PASSWORD_RESET_URL,
                "PASSWORD_RESET_URL",
                production
            );
        }
        const fromAddress = optionalValue(env, "EMAIL_FROM");
        config.from = fromAddress
            ? validateEmailAddress(fromAddress, "EMAIL_FROM")
            : "";
        config.fromName = optionalValue(env, "EMAIL_FROM_NAME") || "Taskora";
        if (config.fromName.length > 100) {
            throw new Error("EMAIL_FROM_NAME must be at most 100 characters and contain no line breaks");
        }
    }

    return config;
}

module.exports = { getEmailConfig };
