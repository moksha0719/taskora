const assert = require("node:assert/strict");
const test = require("node:test");
const {
    StudyScheduleError,
    generateStudySchedulePreview
} = require("../src/services/studyScheduleService");

const DAYS = ["MON", "TUE", "WED", "THU"];

function scheduleInput({
    weeklyTargetMinutes = 600,
    subjects = [{ id: "subject-a", name: "Mathematics", targetMinutesPerWeek: 600 }],
    days = DAYS,
    windows = DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        startMinuteOfDay: 540,
        endMinuteOfDay: 900
    }))
} = {}) {
    return {
        plan: {
            weeklyTargetMinutes,
            studyDaysPerWeek: days.length
        },
        subjects,
        studyDays: days,
        scheduleSettings: { availabilityWindows: windows }
    };
}

function assertScheduleError(fn, code, messagePattern) {
    assert.throws(fn, (error) => {
        assert.ok(error instanceof StudyScheduleError);
        assert.equal(error.code, code);
        assert.match(error.message, messagePattern);
        return true;
    });
}

function totalMinutesBySubject(sessions) {
    return sessions.reduce((totals, session) => {
        totals.set(
            session.subjectId,
            (totals.get(session.subjectId) || 0) + session.durationMinutes
        );
        return totals;
    }, new Map());
}

test("distributes each subject's target minutes evenly across selected days", () => {
    const input = scheduleInput({
        weeklyTargetMinutes: 601,
        subjects: [{ id: "subject-a", name: "Mathematics", targetMinutesPerWeek: 601 }]
    });
    const sessions = generateStudySchedulePreview(input);
    const minutesByDay = new Map(DAYS.map((day) => [day, 0]));

    for (const session of sessions) {
        minutesByDay.set(
            session.dayOfWeek,
            minutesByDay.get(session.dayOfWeek) + session.durationMinutes
        );
    }

    assert.deepEqual([...minutesByDay.values()], [151, 150, 150, 150]);
});

test("generated sessions meet every subject target exactly with valid durations", () => {
    const subjects = [
        { id: "math", name: "Mathematics", targetMinutesPerWeek: 360 },
        { id: "physics", name: "Physics", targetMinutesPerWeek: 240 }
    ];
    const sessions = generateStudySchedulePreview(scheduleInput({
        subjects,
        weeklyTargetMinutes: 600
    }));

    assert.deepEqual([...totalMinutesBySubject(sessions)], [["math", 360], ["physics", 240]]);
    assert.ok(sessions.every((session) =>
        session.durationMinutes >= 1 && session.durationMinutes <= 150
    ));
    assert.ok(sessions.every((session) =>
        session.subjectId && session.subjectName && session.dayOfWeek && session.kind === "STUDY"
    ));
});

test("generated sessions do not overlap and stay within the supplied windows", () => {
    const windows = [
        { dayOfWeek: "MON", startMinuteOfDay: 480, endMinuteOfDay: 600 },
        { dayOfWeek: "MON", startMinuteOfDay: 660, endMinuteOfDay: 900 },
        ...DAYS.slice(1).map((dayOfWeek) => ({
            dayOfWeek,
            startMinuteOfDay: 600,
            endMinuteOfDay: 900
        }))
    ];
    const sessions = generateStudySchedulePreview(scheduleInput({ windows }));
    const sessionsByDay = new Map(DAYS.map((day) => [day, []]));

    for (const session of sessions) {
        sessionsByDay.get(session.dayOfWeek).push(session);
        assert.ok(session.startMinuteOfDay >= 0);
        assert.ok(session.startMinuteOfDay + session.durationMinutes <= 1440);
        assert.ok(windows.some((window) =>
            window.dayOfWeek === session.dayOfWeek &&
            session.startMinuteOfDay >= window.startMinuteOfDay &&
            session.startMinuteOfDay + session.durationMinutes <= window.endMinuteOfDay
        ));
    }

    for (const daySessions of sessionsByDay.values()) {
        daySessions.sort((left, right) => left.startMinuteOfDay - right.startMinuteOfDay);
        for (let index = 1; index < daySessions.length; index += 1) {
            assert.ok(
                daySessions[index - 1].startMinuteOfDay + daySessions[index - 1].durationMinutes <=
                daySessions[index].startMinuteOfDay
            );
        }
    }
});

test("schedule respects the end-of-day boundary without crossing midnight", () => {
    const days = DAYS;
    const windows = days.map((dayOfWeek) => ({
        dayOfWeek,
        startMinuteOfDay: 1290,
        endMinuteOfDay: 1440
    }));
    const sessions = generateStudySchedulePreview(scheduleInput({ windows }));

    assert.equal(sessions.length, 4);
    assert.ok(sessions.every((session) =>
        session.startMinuteOfDay === 1290 &&
        session.durationMinutes === 150 &&
        session.startMinuteOfDay + session.durationMinutes === 1440
    ));
});

test("identical inputs always produce identical schedules", () => {
    const input = scheduleInput({
        subjects: [
            { id: "math", name: "Mathematics", targetMinutesPerWeek: 360 },
            { id: "physics", name: "Physics", targetMinutesPerWeek: 240 }
        ]
    });

    assert.deepEqual(generateStudySchedulePreview(input), generateStudySchedulePreview(input));
});

test("rejects missing availability and schedules whose explicit capacity is insufficient", () => {
    const missingWindows = scheduleInput();
    missingWindows.scheduleSettings = {};
    assertScheduleError(
        () => generateStudySchedulePreview(missingWindows),
        "INVALID_INPUT",
        /availabilityWindows is required/
    );

    const insufficientWindows = DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        startMinuteOfDay: 540,
        endMinuteOfDay: 600
    }));
    assertScheduleError(
        () => generateStudySchedulePreview(scheduleInput({ windows: insufficientWindows })),
        "UNSCHEDULABLE",
        /below the 600-minute weekly target/
    );
});

test("rejects overlapping or invalid availability windows", () => {
    const overlapping = [
        { dayOfWeek: "MON", startMinuteOfDay: 540, endMinuteOfDay: 700 },
        { dayOfWeek: "MON", startMinuteOfDay: 650, endMinuteOfDay: 800 },
        ...DAYS.slice(1).map((dayOfWeek) => ({
            dayOfWeek,
            startMinuteOfDay: 540,
            endMinuteOfDay: 900
        }))
    ];
    assertScheduleError(
        () => generateStudySchedulePreview(scheduleInput({ windows: overlapping })),
        "INVALID_INPUT",
        /overlap on MON/
    );

    const crossingMidnight = DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        startMinuteOfDay: 1380,
        endMinuteOfDay: 1500
    }));
    assertScheduleError(
        () => generateStudySchedulePreview(scheduleInput({ windows: crossingMidnight })),
        "INVALID_INPUT",
        /within one day/
    );
});

test("rejects inconsistent plan totals, unselected days, and missing subject IDs", () => {
    assertScheduleError(
        () => generateStudySchedulePreview(scheduleInput({ weeklyTargetMinutes: 900 })),
        "INVALID_INPUT",
        /sum exactly/
    );

    const unselectedDay = scheduleInput();
    unselectedDay.scheduleSettings.availabilityWindows[0].dayOfWeek = "FRI";
    assertScheduleError(
        () => generateStudySchedulePreview(unselectedDay),
        "INVALID_INPUT",
        /selected study day/
    );

    assertScheduleError(
        () => generateStudySchedulePreview(scheduleInput({
            subjects: [{ name: "Mathematics", targetMinutesPerWeek: 600 }]
        })),
        "INVALID_INPUT",
        /must have an ID/
    );
});
