const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createStudyPlanService,
    StudyPlanServiceError
} = require("../src/services/studyPlanService");

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const PLAN_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function plan(id, status, activeUserId = null, overrides = {}) {
    return {
        id,
        userId: USER_A,
        activeUserId,
        status,
        title: `Plan ${id}`,
        timeZone: "Asia/Colombo",
        startDate: new Date("2026-11-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        subjects: [{
            id: `subject-${id}`,
            scheduleItems: [{
                id: `schedule-${id}`,
                completions: [{ id: `completion-${id}`, occurrenceDate: new Date("2026-11-10T00:00:00.000Z") }]
            }]
        }],
        ...overrides
    };
}

function createPrismaMock(plans) {
    const studyPlan = {
        findFirst: async ({ where }) => plans.find((item) =>
            Object.entries(where).every(([key, value]) => item[key] === value)
        ) || null,
        updateMany: async ({ where, data }) => {
            const existing = plans.find((item) =>
                Object.entries(where).every(([key, value]) => item[key] === value)
            );
            if (!existing) {
                return { count: 0 };
            }
            Object.assign(existing, data);
            return { count: 1 };
        }
    };
    const transaction = { studyPlan };
    return {
        plans,
        $transaction: async (callback) => callback(transaction)
    };
}

function assertServiceError(promise, code, status) {
    return assert.rejects(promise, (error) => {
        assert.ok(error instanceof StudyPlanServiceError);
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        return true;
    });
}

test("activation switches a user's active plan transactionally and preserves completed history", async () => {
    const completed = {
        id: "completion-plan-a",
        occurrenceDate: new Date("2026-11-10T00:00:00.000Z")
    };
    const active = plan(PLAN_A, "ACTIVE", USER_A, {
        subjects: [{ id: "subject-a", scheduleItems: [{ id: "schedule-a", completions: [completed] }] }]
    });
    const target = plan(PLAN_B, "DRAFT", null, {
        subjects: [{ id: "subject-b", scheduleItems: [{ id: "schedule-b", completions: [] }] }]
    });
    const prismaClient = createPrismaMock([active, target]);
    const service = createStudyPlanService({
        prismaClient,
        clock: () => new Date("2026-11-17T10:00:00.000Z")
    });

    const activated = await service.activateStudyPlan(USER_A, PLAN_B);

    assert.equal(activated.id, PLAN_B);
    assert.equal(target.status, "ACTIVE");
    assert.equal(target.activeUserId, USER_A);
    assert.equal(active.status, "DRAFT");
    assert.equal(active.activeUserId, null);
    assert.equal(active.subjects[0].scheduleItems[0].completions[0], completed);
    assert.equal(target.subjects[0].scheduleItems[0].id, "schedule-b");
    assert.equal(prismaClient.plans.filter((item) => item.status === "ACTIVE").length, 1);
});

test("activation rejects non-owned, archived, ended, and unscheduled plans", async () => {
    const archived = plan("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "ARCHIVED");
    const ended = plan("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "DRAFT", null, {
        endDate: new Date("2026-11-16T00:00:00.000Z")
    });
    const unscheduled = plan("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "DRAFT", null, {
        subjects: [{ id: "subject-e", scheduleItems: [] }]
    });
    const prismaClient = createPrismaMock([archived, ended, unscheduled]);
    const service = createStudyPlanService({
        prismaClient,
        clock: () => new Date("2026-11-17T10:00:00.000Z")
    });

    await assertServiceError(service.activateStudyPlan(USER_B, archived.id), "NOT_FOUND", 404);
    await assertServiceError(service.activateStudyPlan(USER_A, archived.id), "INVALID_STATE", 409);
    await assertServiceError(service.activateStudyPlan(USER_A, ended.id), "INVALID_STATE", 409);
    await assertServiceError(service.activateStudyPlan(USER_A, unscheduled.id), "INVALID_STATE", 409);
    assert.equal(prismaClient.plans.every((item) => item.status !== "ACTIVE"), true);
});

test("deactivation retains saved schedules and completed session records", async () => {
    const completed = { id: "completion-a" };
    const active = plan(PLAN_A, "ACTIVE", USER_A, {
        subjects: [{ id: "subject-a", scheduleItems: [{ id: "schedule-a", completions: [completed] }] }]
    });
    const service = createStudyPlanService({
        prismaClient: createPrismaMock([active]),
        clock: () => new Date("2026-11-17T10:00:00.000Z")
    });

    const deactivated = await service.deactivateStudyPlan(USER_A, PLAN_A);

    assert.equal(deactivated.status, "DRAFT");
    assert.equal(deactivated.activeUserId, null);
    assert.equal(active.subjects[0].scheduleItems[0].completions[0], completed);
});
