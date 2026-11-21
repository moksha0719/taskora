"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getPasswordResetTokenTtlMs } = require("../src/config/passwordReset");

test("password reset token lifetime defaults to 30 minutes and accepts configured minutes", () => {
    assert.equal(getPasswordResetTokenTtlMs({}), 30 * 60 * 1000);
    assert.equal(getPasswordResetTokenTtlMs({ PASSWORD_RESET_TOKEN_TTL_MINUTES: "45" }), 45 * 60 * 1000);
    assert.equal(getPasswordResetTokenTtlMs({ PASSWORD_RESET_TOKEN_TTL_MINUTES: "1440" }), 24 * 60 * 60 * 1000);
});

test("password reset token lifetime rejects invalid or unsafe configured values", () => {
    for (const value of ["0", "-1", "1.5", "1e2", "1441", "not-a-number", ""]) {
        if (value === "") {
            assert.equal(getPasswordResetTokenTtlMs({ PASSWORD_RESET_TOKEN_TTL_MINUTES: value }), 30 * 60 * 1000);
            continue;
        }
        assert.throws(
            () => getPasswordResetTokenTtlMs({ PASSWORD_RESET_TOKEN_TTL_MINUTES: value }),
            /PASSWORD_RESET_TOKEN_TTL_MINUTES/
        );
    }
});
