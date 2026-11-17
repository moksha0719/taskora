const assert = require("node:assert/strict");
const test = require("node:test");
const { validateStudyPlanCreateInput } = require("../src/validators/studyPlanValidators");

function validInput(overrides = {}) {
    return {
        title: "  Fall Semester Plan  ",
        startDate: "2026-11-16",
        endDate: "2026-12-20",
        weeklyTargetMinutes: 1200,
        studyDaysPerWeek: 5,
        subjects: [
            { name: "  Mathematics ", targetMinutesPerWeek: 720 },
            { name: "Physics", targetMinutesPerWeek: 480 }
        ],
        ...overrides
    };
}

test("validates and normalizes a plan, defaulting the time zone", () => {
    const result = validateStudyPlanCreateInput(validInput());

    assert.deepEqual(result, {
        data: {
            title: "Fall Semester Plan",
            startDate: "2026-11-16",
            endDate: "2026-12-20",
            timeZone: "Asia/Colombo",
            weeklyTargetMinutes: 1200,
            studyDaysPerWeek: 5,
            subjects: [
                { name: "Mathematics", targetMinutesPerWeek: 720 },
                { name: "Physics", targetMinutesPerWeek: 480 }
            ]
        }
    });
});

test("accepts a valid IANA time zone and optional subject fields", () => {
    const result = validateStudyPlanCreateInput(validInput({
        timeZone: "America/New_York",
        subjects: [
            {
                name: "Mathematics",
                code: " MATH 101 ",
                color: "#aabbCC",
                targetMinutesPerWeek: 1200
            }
        ]
    }));

    assert.deepEqual(result.data.subjects, [{
        name: "Mathematics",
        code: "MATH 101",
        color: "#aabbCC",
        targetMinutesPerWeek: 1200
    }]);
    assert.equal(result.data.timeZone, "America/New_York");
});

test("accepts plan and subject text/count limits at their exact boundaries", () => {
    const subjects = Array.from({ length: 12 }, (_, index) => ({
        name: `S${String(index).padStart(2, "0")}${"N".repeat(117)}`,
        code: "C".repeat(32),
        targetMinutesPerWeek: 50
    }));
    const result = validateStudyPlanCreateInput(validInput({
        title: "P".repeat(120),
        weeklyTargetMinutes: 600,
        subjects
    }));

    assert.equal(result.data.title.length, 120);
    assert.equal(result.data.subjects.length, 12);
    assert.equal(result.data.subjects[0].name.length, 120);
    assert.equal(result.data.subjects[0].code.length, 32);
});

test("rejects plan and subject text/count values above configured limits", () => {
    const subjectSet = (count) => Array.from({ length: count }, (_, index) => ({
        name: `Subject ${index}`,
        targetMinutesPerWeek: 600 / count
    }));
    const inputs = [
        validInput({ title: "P".repeat(121) }),
        validInput({
            weeklyTargetMinutes: 600,
            subjects: [{ name: "N".repeat(121), targetMinutesPerWeek: 600 }]
        }),
        validInput({
            weeklyTargetMinutes: 600,
            subjects: [{ name: "Math", code: "C".repeat(33), targetMinutesPerWeek: 600 }]
        }),
        validInput({ subjects: subjectSet(13) })
    ];

    for (const input of inputs) {
        assert.equal(typeof validateStudyPlanCreateInput(input).error, "string");
    }
});

test("rejects missing fields, wrong types, and unknown or identity fields", () => {
    const missingFields = [
        "title",
        "startDate",
        "endDate",
        "weeklyTargetMinutes",
        "studyDaysPerWeek",
        "subjects"
    ].map((field) => {
        const input = validInput();
        delete input[field];
        return input;
    });
    const invalidInputs = [
        null,
        [],
        ...missingFields,
        { ...validInput(), title: "  " },
        { ...validInput(), weeklyTargetMinutes: "1200" },
        { ...validInput(), studyDaysPerWeek: 7 },
        { ...validInput(), userId: "another-user" },
        { ...validInput(), activeUserId: "another-user" },
        { ...validInput(), status: "ACTIVE" },
        { ...validInput(), extra: true },
        { ...validInput(), subjects: [{ ...validInput().subjects[0], ownerId: "another-user" }] }
    ];

    for (const input of invalidInputs) {
        assert.equal(typeof validateStudyPlanCreateInput(input).error, "string");
    }
});

test("rejects impossible dates and reversed date ranges", () => {
    assert.match(
        validateStudyPlanCreateInput(validInput({ startDate: "2026-02-29" })).error,
        /Start date/
    );
    assert.match(
        validateStudyPlanCreateInput(validInput({ endDate: "2026-04-31" })).error,
        /End date/
    );
    assert.match(
        validateStudyPlanCreateInput(validInput({
            startDate: "2026-12-20",
            endDate: "2026-11-16"
        })).error,
        /on or after/
    );
    assert.equal(validateStudyPlanCreateInput(validInput({
        startDate: "2024-02-29",
        endDate: "2024-03-01"
    })).data.startDate, "2024-02-29");
});

test("rejects invalid time zones and workload ranges", () => {
    assert.match(validateStudyPlanCreateInput(validInput({ timeZone: "Mars/Olympus" })).error, /IANA/);
    assert.match(validateStudyPlanCreateInput(validInput({ timeZone: "" })).error, /IANA/);
    assert.match(
        validateStudyPlanCreateInput(validInput({ timeZone: "A".repeat(65) })).error,
        /IANA/
    );
    assert.match(validateStudyPlanCreateInput(validInput({ weeklyTargetMinutes: 599 })).error, /600 and 2400/);
    assert.match(validateStudyPlanCreateInput(validInput({ weeklyTargetMinutes: 2401 })).error, /600 and 2400/);
});

test("rejects invalid, empty, duplicate, or unbalanced subjects", () => {
    assert.match(validateStudyPlanCreateInput(validInput({ subjects: [] })).error, /non-empty array/);
    assert.match(validateStudyPlanCreateInput(validInput({ subjects: "Math" })).error, /non-empty array/);
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [{ name: "Math", targetMinutesPerWeek: 1200, userId: "another-user" }]
    })).error, /Unsupported subject field/);
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [{ targetMinutesPerWeek: 1200 }]
    })).error, /non-empty name/);
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [
            { name: "Math", targetMinutesPerWeek: 600 },
            { name: " math ", targetMinutesPerWeek: 600 }
        ]
    })).error, /unique/i);
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [{ name: "Math", targetMinutesPerWeek: 0 }]
    })).error, /positive integer/);
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [{ name: "Math", targetMinutesPerWeek: 1199 }]
    })).error, /sum exactly/);
});

test("rejects invalid optional subject field types and colors", () => {
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [{ name: "Math", code: 123, targetMinutesPerWeek: 1200 }]
    })).error, /code must be a non-empty string/);
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [{ name: "Math", code: "   ", targetMinutesPerWeek: 1200 }]
    })).error, /code must be a non-empty string/);
    assert.match(validateStudyPlanCreateInput(validInput({
        subjects: [{ name: "Math", color: "purple", targetMinutesPerWeek: 1200 }]
    })).error, /six-digit hex color/);
});
