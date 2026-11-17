const { StudyPlanServiceError } = require("../services/studyPlanService");
const { StudyScheduleError } = require("../services/studyScheduleService");
const { ScheduleCompletionServiceError } = require("../services/scheduleCompletionService");
const { validateStudyPlanCreateInput } = require("../validators/studyPlanValidators");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_PRISMA_INT = 2147483647;
const SCHEDULE_PREVIEW_FIELDS = new Set([
    "plan",
    "subjects",
    "studyDays",
    "scheduleSettings"
]);

function sendServiceError(error, res) {
    if (error instanceof StudyPlanServiceError) {
        if (error.code === "INVALID_INPUT") {
            return res.status(400).json({ error: error.message });
        }
        if (error.code === "NOT_FOUND") {
            return res.status(404).json({ error: error.message });
        }
        if (error.code === "INVALID_STATE" || error.code === "CONFLICT") {
            return res.status(409).json({ error: error.message });
        }
    }

    return res.status(500).json({ error: "Internal server error" });
}

function validatePlanRequest(req, res) {
    const result = validateStudyPlanCreateInput(req.body);
    if (result.error) {
        res.status(400).json({ error: result.error });
        return false;
    }
    return true;
}

function validatePlanId(req, res) {
    if (!UUID_PATTERN.test(req.params.id)) {
        res.status(400).json({ error: "Invalid study plan ID" });
        return false;
    }
    return true;
}

function dateOnly(value) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
}

function serializeStudyPlan(studyPlan) {
    if (!studyPlan) {
        return studyPlan;
    }

    return {
        ...studyPlan,
        ...(studyPlan.startDate == null ? {} : { startDate: dateOnly(studyPlan.startDate) }),
        ...(studyPlan.endDate == null ? {} : { endDate: dateOnly(studyPlan.endDate) })
    };
}

function serializeCompletion(completion) {
    return {
        ...completion,
        occurrenceDate: dateOnly(completion.occurrenceDate)
    };
}

function validateSchedulePreviewRequest(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        res.status(400).json({ error: "A schedule preview request object is required" });
        return false;
    }

    const unsupportedField = Object.keys(body).find((field) => !SCHEDULE_PREVIEW_FIELDS.has(field));
    if (unsupportedField) {
        res.status(400).json({ error: `Unsupported schedule preview field: ${unsupportedField}` });
        return false;
    }

    const missingField = [...SCHEDULE_PREVIEW_FIELDS].find((field) => !Object.hasOwn(body, field));
    if (missingField) {
        res.status(400).json({ error: `${missingField} is required for a schedule preview` });
        return false;
    }

    return true;
}

function sendScheduleError(error, res) {
    if (error instanceof StudyScheduleError) {
        if (error.code === "INVALID_INPUT") {
            return res.status(400).json({ error: error.message });
        }
        if (error.code === "UNSCHEDULABLE") {
            return res.status(422).json({ error: error.message });
        }
    }

    return res.status(500).json({ error: "Internal server error" });
}

function validateCompletionRouteParams(req, res) {
    if (!UUID_PATTERN.test(req.params.planId)) {
        res.status(400).json({ error: "Invalid study plan ID" });
        return false;
    }
    if (!UUID_PATTERN.test(req.params.itemId)) {
        res.status(400).json({ error: "Invalid schedule item ID" });
        return false;
    }

    const match = DATE_PATTERN.exec(req.params.date);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const calendarDate = new Date(0);
        calendarDate.setUTCFullYear(year, month - 1, day);
        if (
            year >= 1 &&
            month >= 1 &&
            month <= 12 &&
            calendarDate.getUTCFullYear() === year &&
            calendarDate.getUTCMonth() === month - 1 &&
            calendarDate.getUTCDate() === day
        ) {
            return true;
        }
    }

    res.status(400).json({ error: "Occurrence date must be a valid YYYY-MM-DD date" });
    return false;
}

function validateCompletionBody(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        res.status(400).json({ error: "A completion request object is required" });
        return false;
    }

    const unsupportedField = Object.keys(body).find((field) => field !== "actualDurationMinutes");
    if (unsupportedField) {
        res.status(400).json({ error: `Unsupported completion field: ${unsupportedField}` });
        return false;
    }

    const duration = body.actualDurationMinutes;
    if (
        duration !== undefined &&
        duration !== null &&
        (!Number.isSafeInteger(duration) || duration <= 0 || duration > MAX_PRISMA_INT)
    ) {
        res.status(400).json({
            error: "Actual duration minutes must be a positive Prisma integer or null"
        });
        return false;
    }
    return true;
}

function sendCompletionError(error, res) {
    if (error instanceof ScheduleCompletionServiceError) {
        if (error.code === "INVALID_INPUT") {
            return res.status(400).json({ error: error.message });
        }
        if (
            error.code === "PLAN_NOT_FOUND" ||
            error.code === "SCHEDULE_ITEM_NOT_FOUND" ||
            error.code === "COMPLETION_NOT_FOUND"
        ) {
            return res.status(404).json({ error: error.message });
        }
        if (error.code === "CONFLICT") {
            return res.status(409).json({ error: error.message });
        }
    }
    return res.status(500).json({ error: "Internal server error" });
}

function createStudyPlanController(
    studyPlanService,
    studyScheduleService,
    scheduleCompletionService
) {
    async function create(req, res) {
        if (!validatePlanRequest(req, res)) {
            return;
        }

        try {
            const studyPlan = await studyPlanService.createStudyPlan(req.user.id, req.body);
            return res.status(201).json({ studyPlan: serializeStudyPlan(studyPlan) });
        } catch (error) {
            return sendServiceError(error, res);
        }
    }

    async function list(req, res) {
        try {
            const studyPlans = await studyPlanService.listStudyPlans(req.user.id);
            return res.json({ studyPlans: studyPlans.map(serializeStudyPlan) });
        } catch (error) {
            return sendServiceError(error, res);
        }
    }

    async function getActive(req, res) {
        try {
            const studyPlan = await studyPlanService.getActiveStudyPlan(req.user.id);
            return res.json({ studyPlan: serializeStudyPlan(studyPlan) });
        } catch (error) {
            return sendServiceError(error, res);
        }
    }

    async function getById(req, res) {
        if (!validatePlanId(req, res)) {
            return;
        }

        try {
            const studyPlan = await studyPlanService.getStudyPlanById(req.user.id, req.params.id);
            if (!studyPlan) {
                return res.status(404).json({ error: "Study plan not found" });
            }
            return res.json({ studyPlan: serializeStudyPlan(studyPlan) });
        } catch (error) {
            return sendServiceError(error, res);
        }
    }

    async function update(req, res) {
        if (!validatePlanId(req, res) || !validatePlanRequest(req, res)) {
            return;
        }

        try {
            const studyPlan = await studyPlanService.updateStudyPlan(
                req.user.id,
                req.params.id,
                req.body
            );
            if (!studyPlan) {
                return res.status(404).json({ error: "Study plan not found" });
            }
            return res.json({ studyPlan: serializeStudyPlan(studyPlan) });
        } catch (error) {
            return sendServiceError(error, res);
        }
    }

    async function saveSchedule(req, res) {
        if (!validatePlanId(req, res)) {
            return;
        }

        try {
            const studyPlan = await studyPlanService.replaceStudySchedule(
                req.user.id,
                req.params.id,
                req.body
            );
            return res.json({ studyPlan: serializeStudyPlan(studyPlan) });
        } catch (error) {
            return sendServiceError(error, res);
        }
    }

    async function remove(req, res) {
        if (!validatePlanId(req, res)) {
            return;
        }

        try {
            await studyPlanService.deleteStudyPlan(req.user.id, req.params.id);
            return res.status(204).end();
        } catch (error) {
            return sendServiceError(error, res);
        }
    }

    async function generateSchedulePreview(req, res) {
        if (!req.user || typeof req.user.id !== "string" || !req.user.id) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!validateSchedulePreviewRequest(req, res)) {
            return;
        }

        try {
            const schedule = await studyScheduleService.generateStudySchedulePreview(req.body);
            return res.json({ schedule });
        } catch (error) {
            return sendScheduleError(error, res);
        }
    }

    async function upsertScheduleCompletion(req, res) {
        if (!req.user || typeof req.user.id !== "string" || !req.user.id) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!validateCompletionRouteParams(req, res) || !validateCompletionBody(req, res)) {
            return;
        }

        try {
            const completion = await scheduleCompletionService.upsertScheduleCompletion(
                req.user.id,
                req.params.planId,
                req.params.itemId,
                {
                    ...req.body,
                    occurrenceDate: req.params.date
                }
            );
            return res.json({ completion: serializeCompletion(completion) });
        } catch (error) {
            return sendCompletionError(error, res);
        }
    }

    async function deleteScheduleCompletion(req, res) {
        if (!req.user || typeof req.user.id !== "string" || !req.user.id) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!validateCompletionRouteParams(req, res)) {
            return;
        }

        try {
            const completion = await scheduleCompletionService.deleteScheduleCompletion(
                req.user.id,
                req.params.planId,
                req.params.itemId,
                req.params.date
            );
            return res.json({ completion: serializeCompletion(completion), deleted: true });
        } catch (error) {
            return sendCompletionError(error, res);
        }
    }

    async function listScheduleCompletions(req, res) {
        if (!UUID_PATTERN.test(req.params.planId)) {
            return res.status(400).json({ error: "Invalid study plan ID" });
        }

        const unsupportedQuery = Object.keys(req.query).find(
            (field) => field !== "from" && field !== "to"
        );
        if (unsupportedQuery) {
            return res.status(400).json({ error: `Unsupported query parameter: ${unsupportedQuery}` });
        }

        try {
            const completions = await scheduleCompletionService.listScheduleCompletions(
                req.user.id,
                req.params.planId,
                req.query.from,
                req.query.to
            );
            return res.json({ completions: completions.map(serializeCompletion) });
        } catch (error) {
            return sendCompletionError(error, res);
        }
    }

    return {
        create,
        list,
        getActive,
        getById,
        update,
        saveSchedule,
        remove,
        generateSchedulePreview,
        listScheduleCompletions,
        upsertScheduleCompletion,
        deleteScheduleCompletion
    };
}

module.exports = createStudyPlanController;
