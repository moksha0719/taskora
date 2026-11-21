"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getEmailConfig } = require("../src/config/email");
const { createPasswordResetDeliveryService } = require("../src/services/passwordResetDeliveryService");

const resetRequest = {
    email: "student@example.com",
    token: "a".repeat(64),
    expiresAt: new Date("2026-11-18T23:30:00Z")
};

test("email configuration defaults to a non-sending local mock", async () => {
    const service = createPasswordResetDeliveryService({ env: {}, fetchFunction: async () => {
        assert.fail("Mock provider must not make network requests");
    } });

    assert.equal(service.provider, "mock");
    assert.deepEqual(await service.sendResetLink(resetRequest), {
        delivered: false,
        reason: "mock-transport"
    });
});

test("email configuration rejects missing production providers and unsupported settings", () => {
    assert.throws(
        () => getEmailConfig({ NODE_ENV: "production" }),
        { message: "EMAIL_PROVIDER must be configured in production" }
    );
    assert.throws(
        () => getEmailConfig({ EMAIL_PROVIDER: "smtp" }),
        { message: "EMAIL_PROVIDER must be mock, resend, or webhook" }
    );
    assert.throws(
        () => getEmailConfig({ NODE_ENV: "production", EMAIL_PROVIDER: "mock" }),
        { message: "EMAIL_PROVIDER=mock is not allowed in production" }
    );
    assert.throws(
        () => getEmailConfig({ EMAIL_PROVIDER: "resend" }),
        { message: "EMAIL_API_KEY is required for the selected email provider" }
    );
    assert.throws(
        () => getEmailConfig({
            EMAIL_PROVIDER: "resend",
            EMAIL_API_KEY: "test-api-key",
            EMAIL_FROM: "invalid",
            EMAIL_FROM_NAME: "Taskora",
            PASSWORD_RESET_URL: "https://app.example.test/forgot-password"
        }),
        { message: "EMAIL_FROM must be a valid email address" }
    );
    assert.throws(
        () => getEmailConfig({
            NODE_ENV: "production",
            EMAIL_PROVIDER: "resend",
            EMAIL_API_KEY: "test-api-key",
            EMAIL_FROM: "no-reply@example.test",
            EMAIL_FROM_NAME: "Taskora",
            PASSWORD_RESET_URL: "http://app.example.test/forgot-password"
        }),
        { message: "PASSWORD_RESET_URL must use HTTPS in production" }
    );
    assert.throws(
        () => getEmailConfig({ EMAIL_DELIVERY_TIMEOUT_MS: "not-a-number" }),
        { message: "EMAIL_DELIVERY_TIMEOUT_MS must be an integer from 1 to 60000" }
    );
});

test("Resend sends a templated reset email with a tokenized frontend link", async () => {
    let request;
    const service = createPasswordResetDeliveryService({
        env: {
            EMAIL_PROVIDER: "resend",
            EMAIL_API_KEY: "test-api-key",
            EMAIL_FROM: "no-reply@example.test",
            EMAIL_FROM_NAME: "Taskora",
            PASSWORD_RESET_URL: "https://app.example.test/forgot-password"
        },
        fetchFunction: async (url, options) => {
            request = { url, options };
            return { ok: true };
        }
    });

    assert.deepEqual(await service.sendResetLink(resetRequest), { delivered: true });
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers.authorization, "Bearer test-api-key");
    const body = JSON.parse(request.options.body);
    assert.equal(body.from, '"Taskora" <no-reply@example.test>');
    assert.deepEqual(body.to, [resetRequest.email]);
    assert.equal(body.subject, "Reset your Taskora password");
    assert.match(body.text, new RegExp(`token=${resetRequest.token}`));
    assert.match(body.html, /Choose a new password/);
    assert.match(body.text, /2026-11-18T23:30:00.000Z/);
});

test("provider rejection and connection failures return safe delivery results", async () => {
    const env = {
        EMAIL_PROVIDER: "resend",
        EMAIL_API_KEY: "test-api-key",
        EMAIL_FROM: "no-reply@example.test",
        EMAIL_FROM_NAME: "Taskora",
        PASSWORD_RESET_URL: "https://app.example.test/forgot-password"
    };
    const rejected = createPasswordResetDeliveryService({
        env,
        fetchFunction: async () => ({ ok: false, status: 401 })
    });
    const failed = createPasswordResetDeliveryService({
        env,
        fetchFunction: async () => {
            throw new Error("sensitive provider detail");
        }
    });

    assert.deepEqual(await rejected.sendResetLink(resetRequest), {
        delivered: false,
        reason: "delivery-provider-rejected"
    });
    assert.deepEqual(await failed.sendResetLink(resetRequest), {
        delivered: false,
        reason: "delivery-provider-error"
    });
});

test("email provider timeout aborts the request without exposing provider details", async () => {
    const service = createPasswordResetDeliveryService({
        env: {
            EMAIL_PROVIDER: "resend",
            EMAIL_API_KEY: "test-api-key",
            EMAIL_FROM: "no-reply@example.test",
            EMAIL_FROM_NAME: "Taskora",
            PASSWORD_RESET_URL: "https://app.example.test/forgot-password",
            EMAIL_DELIVERY_TIMEOUT_MS: "5"
        },
        fetchFunction: async (_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () => {
                reject(new Error("sensitive timeout detail"));
            }, { once: true });
        })
    });

    assert.deepEqual(await service.sendResetLink(resetRequest), {
        delivered: false,
        reason: "delivery-provider-timeout"
    });
});

test("legacy webhook delivery preserves payload and signs requests when configured", async () => {
    let request;
    const service = createPasswordResetDeliveryService({
        env: {
            PASSWORD_RESET_DELIVERY_URL: "https://provider.example/reset",
            PASSWORD_RESET_DELIVERY_AUTHORIZATION: "Bearer test-provider-secret",
            PASSWORD_RESET_DELIVERY_SIGNING_SECRET: "test-signing-secret"
        },
        fetchFunction: async (url, options) => {
            request = { url, options };
            return { ok: true };
        }
    });

    assert.equal(service.provider, "webhook");
    assert.deepEqual(await service.sendResetLink(resetRequest), { delivered: true });
    assert.equal(request.url, "https://provider.example/reset");
    assert.equal(request.options.headers.authorization, "Bearer test-provider-secret");
    assert.match(request.options.headers["x-taskora-signature"], /^[a-f0-9]{64}$/);
    assert.deepEqual(JSON.parse(request.options.body), {
        email: resetRequest.email,
        token: resetRequest.token,
        expiresAt: resetRequest.expiresAt.toISOString()
    });
});

test("production rejects insecure webhook URLs during configuration", () => {
    assert.throws(
        () => createPasswordResetDeliveryService({
            env: {
                NODE_ENV: "production",
                EMAIL_PROVIDER: "webhook",
                PASSWORD_RESET_DELIVERY_URL: "http://provider.example/reset"
            }
        }),
        { message: "PASSWORD_RESET_DELIVERY_URL must use HTTPS in production" }
    );
});
