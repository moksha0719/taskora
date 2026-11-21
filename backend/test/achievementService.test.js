"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    longestConsecutiveDateStreak,
    longestHabitStreak,
    getAchievementProgress
} = require("../src/services/achievementService");

test("achievement progress computes real metrics and caps at requirement", () => {
    const streak = longestConsecutiveDateStreak([
        { date: new Date("2026-11-14T00:00:00Z") },
        { date: new Date("2026-11-15T00:00:00Z") },
        { date: new Date("2026-11-16T00:00:00Z") },
        { date: new Date("2026-11-17T00:00:00Z") },
        { date: new Date("2026-11-18T00:00:00Z") },
        { date: new Date("2026-11-19T00:00:00Z") },
        { date: new Date("2026-11-20T00:00:00Z") }
    ]);
    assert.equal(streak, 7);
    assert.equal(getAchievementProgress({ key: "habit_7", requirement: 7 }, {
        longestHabitStreak: streak
    }), 7);
    assert.equal(getAchievementProgress({ key: "focus_10", requirement: 10 }, {
        focusCount: 14
    }), 10);
    assert.equal(getAchievementProgress({ key: "unknown", requirement: 5 }, {}), 0);
});

test("habit achievement streaks must come from one habit, not merged dates", () => {
    const checkIns = [
        { habitId: "habit-a", date: new Date("2026-11-14T00:00:00Z") },
        { habitId: "habit-a", date: new Date("2026-11-15T00:00:00Z") },
        { habitId: "habit-a", date: new Date("2026-11-16T00:00:00Z") },
        { habitId: "habit-a", date: new Date("2026-11-17T00:00:00Z") },
        { habitId: "habit-b", date: new Date("2026-11-18T00:00:00Z") },
        { habitId: "habit-b", date: new Date("2026-11-19T00:00:00Z") },
        { habitId: "habit-b", date: new Date("2026-11-20T00:00:00Z") }
    ];

    assert.equal(longestConsecutiveDateStreak(checkIns), 7);
    assert.equal(longestHabitStreak(checkIns), 4);
});
