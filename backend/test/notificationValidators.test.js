const assert = require("node:assert/strict");
const test = require("node:test");
const {
    isValidNotificationId,
    validateNotificationListQuery
} = require("../src/validators/notificationValidators");

test("notification list query applies defaults and parses supported filters", () => {
    assert.deepEqual(validateNotificationListQuery({}), {
        data: { type: undefined, unreadOnly: false, page: 1, limit: 20 }
    });
    assert.deepEqual(validateNotificationListQuery({
        type: "task_due",
        unreadOnly: "true",
        page: "3",
        limit: "50"
    }), {
        data: { type: "task_due", unreadOnly: true, page: 3, limit: 50 }
    });
});

test("notification list query rejects unknown, repeated, malformed, and out-of-range values", () => {
    const invalidQueries = [
        { userId: "another-user" },
        { type: "deadline" },
        { unreadOnly: "yes" },
        { page: "0" },
        { page: "1.5" },
        { page: "9007199254740992" },
        { limit: "101" },
        { limit: ["10", "20"] }
    ];

    for (const query of invalidQueries) {
        assert.equal(typeof validateNotificationListQuery(query).error, "string");
    }
});

test("notification IDs must use the UUID shape", () => {
    assert.equal(isValidNotificationId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), true);
    assert.equal(isValidNotificationId("not-a-uuid"), false);
    assert.equal(isValidNotificationId(["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]), false);
});
