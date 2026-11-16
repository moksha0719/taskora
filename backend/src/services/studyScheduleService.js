const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_INDEX = new Map(DAYS_OF_WEEK.map((day, index) => [day, index]));
const MIN_WEEKLY_TARGET_MINUTES = 600;
const MAX_WEEKLY_TARGET_MINUTES = 2400;
const MAX_SESSION_MINUTES = 150;

class StudyScheduleError extends Error {
    constructor(message, code = "INVALID_INPUT") {
        super(message);
        this.name = "StudyScheduleError";
        this.code = code;
    }
}

function invalidInput(message) {
    throw new StudyScheduleError(message);
}

function validateInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        invalidInput("A schedule preview request object is required");
    }

    const { plan, subjects, studyDays, scheduleSettings } = input;
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
        invalidInput("Validated plan details are required");
    }
    if (
        !Number.isInteger(plan.weeklyTargetMinutes) ||
        plan.weeklyTargetMinutes < MIN_WEEKLY_TARGET_MINUTES ||
        plan.weeklyTargetMinutes > MAX_WEEKLY_TARGET_MINUTES
    ) {
        invalidInput("Plan weeklyTargetMinutes must be an integer between 600 and 2400");
    }
    if (![4, 5, 6].includes(plan.studyDaysPerWeek)) {
        invalidInput("Plan studyDaysPerWeek must be 4, 5, or 6");
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
        invalidInput("Subjects must be a non-empty array");
    }
    const subjectIds = new Set();
    let subjectTargetTotal = 0;
    const validatedSubjects = subjects.map((subject, index) => {
        if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
            invalidInput(`Subject at index ${index} must be an object`);
        }
        if (typeof subject.id !== "string" || !subject.id.trim()) {
            invalidInput(`Subject at index ${index} must have an ID`);
        }
        if (subjectIds.has(subject.id)) {
            invalidInput("Subject IDs must be unique");
        }
        subjectIds.add(subject.id);
        if (typeof subject.name !== "string" || !subject.name.trim()) {
            invalidInput(`Subject at index ${index} must have a non-empty name`);
        }
        if (!Number.isSafeInteger(subject.targetMinutesPerWeek) || subject.targetMinutesPerWeek <= 0) {
            invalidInput(`Subject at index ${index} targetMinutesPerWeek must be a positive integer`);
        }

        subjectTargetTotal += subject.targetMinutesPerWeek;
        if (!Number.isSafeInteger(subjectTargetTotal)) {
            invalidInput("Subject target minutes must sum exactly to the plan weekly target");
        }

        return {
            id: subject.id,
            name: subject.name.trim(),
            targetMinutesPerWeek: subject.targetMinutesPerWeek
        };
    });
    if (subjectTargetTotal !== plan.weeklyTargetMinutes) {
        invalidInput("Subject target minutes must sum exactly to the plan weekly target");
    }

    if (
        !Array.isArray(studyDays) ||
        studyDays.length !== plan.studyDaysPerWeek ||
        new Set(studyDays).size !== studyDays.length ||
        studyDays.some((day) => !DAY_INDEX.has(day))
    ) {
        invalidInput("Study days must contain the selected 4, 5, or 6 unique weekdays");
    }
    const orderedDays = [...studyDays].sort((left, right) => DAY_INDEX.get(left) - DAY_INDEX.get(right));

    if (!scheduleSettings || typeof scheduleSettings !== "object" || Array.isArray(scheduleSettings)) {
        invalidInput("Explicit schedule settings are required");
    }
    const { availabilityWindows } = scheduleSettings;
    if (!Array.isArray(availabilityWindows) || availabilityWindows.length === 0) {
        invalidInput(
            "scheduleSettings.availabilityWindows is required; provide explicit available time windows for the selected study days"
        );
    }

    const windowsByDay = new Map(orderedDays.map((day) => [day, []]));
    for (let index = 0; index < availabilityWindows.length; index += 1) {
        const window = availabilityWindows[index];
        if (!window || typeof window !== "object" || Array.isArray(window)) {
            invalidInput(`Availability window at index ${index} must be an object`);
        }
        if (!windowsByDay.has(window.dayOfWeek)) {
            invalidInput(`Availability window at index ${index} must use a selected study day`);
        }
        if (
            !Number.isInteger(window.startMinuteOfDay) ||
            window.startMinuteOfDay < 0 ||
            window.startMinuteOfDay >= 1440 ||
            !Number.isInteger(window.endMinuteOfDay) ||
            window.endMinuteOfDay > 1440 ||
            window.endMinuteOfDay <= window.startMinuteOfDay
        ) {
            invalidInput(`Availability window at index ${index} must be within one day and have positive duration`);
        }
        windowsByDay.get(window.dayOfWeek).push({
            dayOfWeek: window.dayOfWeek,
            startMinuteOfDay: window.startMinuteOfDay,
            endMinuteOfDay: window.endMinuteOfDay
        });
    }

    let totalCapacity = 0;
    const capacityByDay = new Map();
    for (const day of orderedDays) {
        const dayWindows = windowsByDay.get(day);
        dayWindows.sort((left, right) =>
            left.startMinuteOfDay - right.startMinuteOfDay ||
            left.endMinuteOfDay - right.endMinuteOfDay
        );

        for (let index = 1; index < dayWindows.length; index += 1) {
            if (dayWindows[index].startMinuteOfDay < dayWindows[index - 1].endMinuteOfDay) {
                invalidInput(`Availability windows overlap on ${day}`);
            }
        }

        const dayCapacity = dayWindows.reduce(
            (total, window) => total + window.endMinuteOfDay - window.startMinuteOfDay,
            0
        );
        if (dayCapacity === 0) {
            invalidInput(`At least one explicit availability window is required for ${day}`);
        }
        capacityByDay.set(day, dayCapacity);
        totalCapacity += dayCapacity;
    }

    if (totalCapacity < plan.weeklyTargetMinutes) {
        throw new StudyScheduleError(
            `Provided availability totals ${totalCapacity} minutes, below the ${plan.weeklyTargetMinutes}-minute weekly target`,
            "UNSCHEDULABLE"
        );
    }

    return {
        subjects: validatedSubjects,
        days: orderedDays,
        windowsByDay,
        capacityByDay,
        weeklyTargetMinutes: plan.weeklyTargetMinutes
    };
}

function distributeSubjectMinutes(subject, days, capacityByDay, usedByDay) {
    const allocation = new Map(days.map((day) => [day, 0]));

    for (let minute = 0; minute < subject.targetMinutesPerWeek; minute += 1) {
        const availableDays = days.filter((day) => usedByDay.get(day) < capacityByDay.get(day));
        if (availableDays.length === 0) {
            throw new StudyScheduleError(
                "The weekly target cannot fit within the supplied availability windows",
                "UNSCHEDULABLE"
            );
        }

        availableDays.sort((left, right) =>
            allocation.get(left) - allocation.get(right) ||
            usedByDay.get(left) - usedByDay.get(right) ||
            days.indexOf(left) - days.indexOf(right)
        );
        const selectedDay = availableDays[0];
        allocation.set(selectedDay, allocation.get(selectedDay) + 1);
        usedByDay.set(selectedDay, usedByDay.get(selectedDay) + 1);
    }

    return allocation;
}

function createSessionsForDay(day, subjects, allocations, windows) {
    const sessions = [];
    let windowIndex = 0;
    let minuteInWindow = windows[0].startMinuteOfDay;

    for (const subject of subjects) {
        let remainingMinutes = allocations.get(subject.id).get(day);
        while (remainingMinutes > 0) {
            while (
                windowIndex < windows.length &&
                minuteInWindow >= windows[windowIndex].endMinuteOfDay
            ) {
                windowIndex += 1;
                if (windowIndex < windows.length) {
                    minuteInWindow = windows[windowIndex].startMinuteOfDay;
                }
            }

            if (windowIndex >= windows.length) {
                throw new StudyScheduleError(
                    `The weekly target cannot fit within the supplied availability windows on ${day}`,
                    "UNSCHEDULABLE"
                );
            }

            const window = windows[windowIndex];
            const availableMinutes = window.endMinuteOfDay - minuteInWindow;
            const durationMinutes = Math.min(
                remainingMinutes,
                MAX_SESSION_MINUTES,
                availableMinutes
            );
            if (durationMinutes < 1) {
                throw new StudyScheduleError(
                    `No valid session can be placed in the supplied availability windows on ${day}`,
                    "UNSCHEDULABLE"
                );
            }

            sessions.push({
                subjectId: subject.id,
                subjectName: subject.name,
                dayOfWeek: day,
                startMinuteOfDay: minuteInWindow,
                durationMinutes,
                kind: "STUDY"
            });
            minuteInWindow += durationMinutes;
            remainingMinutes -= durationMinutes;
        }
    }

    return sessions;
}

/**
 * Preview contract: callers provide validated plan totals, identified subjects,
 * the selected weekdays, and explicit availabilityWindows shaped as
 * { dayOfWeek, startMinuteOfDay, endMinuteOfDay }. Availability is mandatory:
 * the current schema and UI define no clock-time availability, so this service
 * does not infer a user's free time. Sessions are STUDY blocks; review rules
 * and break durations are not defined by the current project contract.
 */
function generateStudySchedulePreview(input) {
    const validated = validateInput(input);
    const usedByDay = new Map(validated.days.map((day) => [day, 0]));
    const allocations = new Map();

    for (const subject of validated.subjects) {
        allocations.set(
            subject.id,
            distributeSubjectMinutes(
                subject,
                validated.days,
                validated.capacityByDay,
                usedByDay
            )
        );
    }

    return validated.days.flatMap((day) =>
        createSessionsForDay(
            day,
            validated.subjects,
            allocations,
            validated.windowsByDay.get(day)
        )
    );
}

module.exports = {
    StudyScheduleError,
    generateStudySchedulePreview
};
