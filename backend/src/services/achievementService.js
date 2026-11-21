const ACHIEVEMENT_PROGRESS_KEYS = {
    first_focus: "focusCount",
    focus_10: "focusCount",
    task_10: "completedTaskCount",
    habit_7: "longestHabitStreak",
    room_participant: "roomCount"
};

function longestConsecutiveDateStreak(entries) {
    const dates = [...new Set(entries.map((entry) => {
        const date = entry && entry.date;
        return date instanceof Date ? date.toISOString().slice(0, 10) : null;
    }).filter(Boolean))].sort();
    let longest = 0;
    let current = 0;
    let previous = null;
    for (const date of dates) {
        if (!previous) {
            current = 1;
        } else {
            const gap = (
                new Date(`${date}T00:00:00Z`).getTime()
                - new Date(`${previous}T00:00:00Z`).getTime()
            ) / 86400000;
            current = gap === 1 ? current + 1 : 1;
        }
        longest = Math.max(longest, current);
        previous = date;
    }
    return longest;
}

function longestHabitStreak(checkIns) {
    const datesByHabit = new Map();
    for (const checkIn of checkIns) {
        const habitId = checkIn && checkIn.habitId;
        if (typeof habitId !== "string") {
            continue;
        }
        if (!datesByHabit.has(habitId)) {
            datesByHabit.set(habitId, []);
        }
        datesByHabit.get(habitId).push(checkIn);
    }
    return Math.max(
        0,
        ...[...datesByHabit.values()].map(longestConsecutiveDateStreak)
    );
}

function getAchievementProgress(achievement, metrics) {
    const metricName = ACHIEVEMENT_PROGRESS_KEYS[achievement.key];
    const rawProgress = metricName ? Number(metrics[metricName]) || 0 : 0;
    return Math.min(achievement.requirement, rawProgress);
}

module.exports = {
    longestConsecutiveDateStreak,
    longestHabitStreak,
    getAchievementProgress
};
