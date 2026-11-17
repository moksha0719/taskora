const PLAN_FIELDS = new Set([
    "title",
    "startDate",
    "endDate",
    "timeZone",
    "weeklyTargetMinutes",
    "studyDaysPerWeek",
    "subjects"
]);
const SUBJECT_FIELDS = new Set(["name", "code", "color", "targetMinutesPerWeek"]);
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_TIME_ZONE = "Asia/Colombo";
const STUDY_DAYS_PER_WEEK = new Set([4, 5, 6]);
const MIN_WEEKLY_TARGET_MINUTES = 600;
const MAX_WEEKLY_TARGET_MINUTES = 2400;
const MAX_PLAN_TITLE_LENGTH = 120;
const MAX_SUBJECT_NAME_LENGTH = 120;
const MAX_SUBJECT_CODE_LENGTH = 32;
const MAX_SUBJECTS_PER_PLAN = 12;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isValidDate(value) {
    if (typeof value !== "string") {
        return false;
    }

    const match = DATE_PATTERN.exec(value);
    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12) {
        return false;
    }

    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ][month - 1];

    return day >= 1 && day <= daysInMonth;
}

function isValidTimeZone(value) {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        value !== value.trim() ||
        value.length > 64
    ) {
        return false;
    }

    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

function validateStudyPlanCreateInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "A JSON object is required" };
    }

    const unknownField = Object.keys(body).find((field) => !PLAN_FIELDS.has(field));
    if (unknownField) {
        return { error: `Unsupported study plan field: ${unknownField}` };
    }

    if (typeof body.title !== "string" || !body.title.trim()) {
        return { error: "Title must be a non-empty string" };
    }

    if (body.title.trim().length > MAX_PLAN_TITLE_LENGTH) {
        return { error: `Title must be ${MAX_PLAN_TITLE_LENGTH} characters or fewer` };
    }

    if (!isValidDate(body.startDate)) {
        return { error: "Start date must be a valid YYYY-MM-DD date" };
    }

    if (!isValidDate(body.endDate)) {
        return { error: "End date must be a valid YYYY-MM-DD date" };
    }

    if (body.endDate < body.startDate) {
        return { error: "End date must be on or after start date" };
    }

    const timeZone = Object.hasOwn(body, "timeZone") ? body.timeZone : DEFAULT_TIME_ZONE;
    if (!isValidTimeZone(timeZone)) {
        return { error: "Time zone must be a valid IANA time zone" };
    }

    if (
        !Number.isInteger(body.weeklyTargetMinutes) ||
        body.weeklyTargetMinutes < MIN_WEEKLY_TARGET_MINUTES ||
        body.weeklyTargetMinutes > MAX_WEEKLY_TARGET_MINUTES
    ) {
        return { error: "Weekly target minutes must be an integer between 600 and 2400" };
    }

    if (!STUDY_DAYS_PER_WEEK.has(body.studyDaysPerWeek)) {
        return { error: "Study days per week must be 4, 5, or 6" };
    }

    if (!Array.isArray(body.subjects) || body.subjects.length === 0) {
        return { error: "Subjects must be a non-empty array" };
    }

    if (body.subjects.length > MAX_SUBJECTS_PER_PLAN) {
        return { error: `Subjects must contain ${MAX_SUBJECTS_PER_PLAN} or fewer entries` };
    }

    const subjectNames = new Set();
    let subjectTargetTotal = 0;
    const subjects = [];

    for (let index = 0; index < body.subjects.length; index += 1) {
        const subject = body.subjects[index];
        if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
            return { error: `Subject at index ${index} must be a JSON object` };
        }

        const unknownSubjectField = Object.keys(subject).find((field) => !SUBJECT_FIELDS.has(field));
        if (unknownSubjectField) {
            return { error: `Unsupported subject field: ${unknownSubjectField}` };
        }

        if (typeof subject.name !== "string" || !subject.name.trim()) {
            return { error: `Subject at index ${index} must have a non-empty name` };
        }

        if (subject.name.trim().length > MAX_SUBJECT_NAME_LENGTH) {
            return { error: `Subject at index ${index} name must be ${MAX_SUBJECT_NAME_LENGTH} characters or fewer` };
        }

        const name = subject.name.trim();
        const normalizedName = name.normalize("NFKC").toLowerCase();
        if (subjectNames.has(normalizedName)) {
            return { error: "Subject names must be unique (case-insensitive)" };
        }
        subjectNames.add(normalizedName);

        if (!Number.isSafeInteger(subject.targetMinutesPerWeek) || subject.targetMinutesPerWeek <= 0) {
            return { error: `Subject at index ${index} targetMinutesPerWeek must be a positive integer` };
        }

        subjectTargetTotal += subject.targetMinutesPerWeek;
        if (!Number.isSafeInteger(subjectTargetTotal)) {
            return { error: "Subject target minutes must sum exactly to weeklyTargetMinutes" };
        }

        const validatedSubject = {
            name,
            targetMinutesPerWeek: subject.targetMinutesPerWeek
        };

        if (Object.hasOwn(subject, "code")) {
            if (typeof subject.code !== "string" || !subject.code.trim()) {
                return { error: `Subject at index ${index} code must be a non-empty string` };
            }
            if (subject.code.trim().length > MAX_SUBJECT_CODE_LENGTH) {
                return { error: `Subject at index ${index} code must be ${MAX_SUBJECT_CODE_LENGTH} characters or fewer` };
            }
            validatedSubject.code = subject.code.trim();
        }

        if (Object.hasOwn(subject, "color")) {
            if (typeof subject.color !== "string" || !HEX_COLOR_PATTERN.test(subject.color.trim())) {
                return { error: `Subject at index ${index} color must be a six-digit hex color` };
            }
            validatedSubject.color = subject.color.trim();
        }

        subjects.push(validatedSubject);
    }

    if (subjectTargetTotal !== body.weeklyTargetMinutes) {
        return { error: "Subject target minutes must sum exactly to weeklyTargetMinutes" };
    }

    return {
        data: {
            title: body.title.trim(),
            startDate: body.startDate,
            endDate: body.endDate,
            timeZone,
            weeklyTargetMinutes: body.weeklyTargetMinutes,
            studyDaysPerWeek: body.studyDaysPerWeek,
            subjects
        }
    };
}

module.exports = { validateStudyPlanCreateInput };
