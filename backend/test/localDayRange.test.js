"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getLocalDayRange } = require("../src/lib/localDayRange");

test("local day range uses UTC when that is the selected time zone", () => {
    const range = getLocalDayRange(new Date("2026-11-21T23:59:59.999Z"));

    assert.equal(range.date, "2026-11-21");
    assert.equal(range.start.toISOString(), "2026-11-21T00:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-11-22T00:00:00.000Z");
});

test("local day range follows the selected zone across UTC date boundaries", () => {
    const range = getLocalDayRange(new Date("2026-11-20T19:00:00.000Z"), "Asia/Colombo");

    assert.equal(range.date, "2026-11-21");
    assert.equal(range.start.toISOString(), "2026-11-20T18:30:00.000Z");
    assert.equal(range.end.toISOString(), "2026-11-21T18:30:00.000Z");
});

test("local day range accounts for daylight-saving transitions", () => {
    const range = getLocalDayRange(new Date("2026-03-08T16:00:00.000Z"), "America/New_York");

    assert.equal(range.date, "2026-03-08");
    assert.equal(range.start.toISOString(), "2026-03-08T05:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-03-09T04:00:00.000Z");
    assert.equal(range.end.getTime() - range.start.getTime(), 23 * 60 * 60 * 1000);
});

test("local day range rejects an invalid time zone", () => {
    assert.throws(
        () => getLocalDayRange(new Date("2026-11-21T12:00:00.000Z"), "Mars/Olympus"),
        RangeError
    );
});
