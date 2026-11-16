const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createStudyPlanService,
    StudyPlanServiceError
} = require("../src/services/studyPlanService");

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function validInput(overrides = {}) {
    return {
        title: "  Fall Semester Plan  ",
        startDate: "2026-11-16",
        endDate: "2026-12-20",
        weeklyTargetMinutes: 1200,
        studyDaysPerWeek: 5,
        subjects: [
            { name: "  Mathematics ", targetMinutesPerWeek: 720 },
            { name: "Physics", targetMinutesPerWeek: 480, code: "PHY", color: "#AABBCC" }
        ],
        ...overrides
    };
}

function createPrismaMock(overrides = {}) {
    const transaction = {
        studyPlan: {
            updateMany: async () => ({ count: 1 }),
            findFirst: async () => null,
            deleteMany: async () => ({ count: 1 }),
            ...(overrides.transaction && overrides.transaction.studyPlan)
        },
        studySubject: {
            deleteMany: async () => ({ count: 2 }),
            createMany: async () => ({ count: 2 }),
            ...(overrides.transaction && overrides.transaction.studySubject)
        }
    };
    const prismaClient = {
        studyPlan: {
            create: async () => null,
            findMany: async () => [],
            findFirst: async () => null,
            ...(overrides.studyPlan || {})
        },
        $transaction: async (callback) => callback(transaction),
        ...overrides,
        transaction
    };
    return prismaClient;
}

function assertServiceError(promise, code, status) {
    return assert.rejects(promise, (error) => {
        assert.ok(error instanceof StudyPlanServiceError);
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        return true;
    });
}

test("create validates input and writes a DRAFT owned by the caller with nested subjects", async () => {
    let args;
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            studyPlan: {
                create: async (createArgs) => {
                    args = createArgs;
                    return { id: PLAN_ID, ...createArgs.data };
                }
            }
        })
    });

    const plan = await service.createStudyPlan(USER_A, validInput());

    assert.equal(plan.id, PLAN_ID);
    assert.equal(args.data.userId, USER_A);
    assert.equal(args.data.status, "DRAFT");
    assert.equal(args.data.title, "Fall Semester Plan");
    assert.equal(args.data.startDate.toISOString(), "2026-11-16T00:00:00.000Z");
    assert.deepEqual(args.data.subjects.create, [
        {
            name: "Mathematics",
            code: "",
            color: "#9885E8",
            targetMinutesPerWeek: 720
        },
        {
            name: "Physics",
            code: "PHY",
            color: "#AABBCC",
            targetMinutesPerWeek: 480
        }
    ]);
    assert.equal(args.include.subjects, true);
});

test("create rejects client-controlled identity/status fields and invalid payloads", async () => {
    let calls = 0;
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            studyPlan: { create: async () => { calls += 1; } }
        })
    });

    await assertServiceError(
        service.createStudyPlan(USER_A, { ...validInput(), userId: USER_B }),
        "INVALID_INPUT",
        400
    );
    await assertServiceError(
        service.createStudyPlan(USER_A, { ...validInput(), status: "ACTIVE" }),
        "INVALID_INPUT",
        400
    );
    await assertServiceError(service.createStudyPlan("", validInput()), "INVALID_INPUT", 400);
    assert.equal(calls, 0);
});

test("create maps Prisma unique violations to a safe conflict error", async () => {
    const prismaClient = createPrismaMock({
        studyPlan: {
            create: async () => {
                const error = new Error("sensitive database detail");
                error.code = "P2002";
                throw error;
            }
        }
    });
    const service = createStudyPlanService({ prismaClient });

    await assert.rejects(service.createStudyPlan(USER_A, validInput()), (error) => {
        assert.equal(error.code, "CONFLICT");
        assert.equal(error.status, 409);
        assert.doesNotMatch(error.message, /sensitive/i);
        return true;
    });
});

test("list scopes plans to the requested user and includes subjects", async () => {
    let args;
    const expected = [{ id: PLAN_ID, userId: USER_A, subjects: [] }];
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            studyPlan: {
                findMany: async (findArgs) => {
                    args = findArgs;
                    return expected;
                }
            }
        })
    });

    assert.equal(await service.listStudyPlans(USER_A), expected);
    assert.deepEqual(args.where, { userId: USER_A });
    assert.equal(args.include.subjects, true);
});

test("active plan lookup includes schedules and returns null when absent", async () => {
    let args;
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            studyPlan: {
                findFirst: async (findArgs) => {
                    args = findArgs;
                    return null;
                }
            }
        })
    });

    assert.equal(await service.getActiveStudyPlan(USER_A), null);
    assert.deepEqual(args.where, { userId: USER_A, status: "ACTIVE" });
    assert.equal(args.include.subjects.include.scheduleItems, true);
});

test("get by ID scopes ownership and includes subjects with schedule items", async () => {
    let args;
    const expected = { id: PLAN_ID, userId: USER_A, subjects: [] };
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            studyPlan: {
                findFirst: async (findArgs) => {
                    args = findArgs;
                    return expected;
                }
            }
        })
    });

    assert.equal(await service.getStudyPlanById(USER_A, PLAN_ID), expected);
    assert.deepEqual(args.where, { id: PLAN_ID, userId: USER_A });
    assert.equal(args.include.subjects.include.scheduleItems, true);
});

test("update replaces the complete DRAFT plan and its subjects within one transaction", async () => {
    const calls = [];
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            $transaction: async (callback) => {
                calls.push("transaction");
                return callback({
                    studyPlan: {
                        updateMany: async (args) => {
                            calls.push(["updateMany", args]);
                            return { count: 1 };
                        },
                        findFirst: async (args) => {
                            calls.push(["findFirst", args]);
                            return { id: PLAN_ID, userId: USER_A, subjects: [] };
                        }
                    },
                    studySubject: {
                        deleteMany: async (args) => {
                            calls.push(["deleteMany", args]);
                            return { count: 1 };
                        },
                        createMany: async (args) => {
                            calls.push(["createMany", args]);
                            return { count: 1 };
                        }
                    }
                });
            }
        })
    });

    const result = await service.updateStudyPlan(USER_A, PLAN_ID, validInput({
        title: "Updated Plan",
        weeklyTargetMinutes: 900,
        subjects: [{ name: "Chemistry", targetMinutesPerWeek: 900 }]
    }));

    assert.equal(result.id, PLAN_ID);
    assert.equal(calls[0], "transaction");
    assert.deepEqual(calls[1][1].where, { id: PLAN_ID, userId: USER_A, status: "DRAFT" });
    assert.equal(calls[1][1].data.title, "Updated Plan");
    assert.deepEqual(calls[2][1], { where: { planId: PLAN_ID } });
    assert.deepEqual(calls[3][1].data, [{
        name: "Chemistry",
        code: "",
        color: "#9885E8",
        targetMinutesPerWeek: 900,
        planId: PLAN_ID
    }]);
    assert.deepEqual(calls[4][1].where, { id: PLAN_ID, userId: USER_A });
});

test("update rejects invalid, missing, non-owned, and non-DRAFT plans", async () => {
    const serviceFor = (existingPlan, count = 0) => createStudyPlanService({
        prismaClient: createPrismaMock({
            transaction: {
                studyPlan: {
                    updateMany: async () => ({ count }),
                    findFirst: async ({ where }) => (
                        existingPlan && existingPlan.userId === where.userId ? existingPlan : null
                    )
                }
            }
        })
    });

    await assertServiceError(
        serviceFor(null).updateStudyPlan(USER_A, PLAN_ID, { ...validInput(), userId: USER_B }),
        "INVALID_INPUT",
        400
    );
    await assertServiceError(
        serviceFor({ status: "DRAFT", userId: USER_B }).updateStudyPlan(USER_A, PLAN_ID, validInput()),
        "NOT_FOUND",
        404
    );
    await assertServiceError(
        serviceFor({ status: "ACTIVE", userId: USER_A }).updateStudyPlan(USER_A, PLAN_ID, validInput()),
        "INVALID_STATE",
        409
    );
});

test("delete allows owned DRAFT and ARCHIVED plans only", async () => {
    let deleteArgs;
    const serviceFor = (status) => createStudyPlanService({
        prismaClient: createPrismaMock({
            transaction: {
                studyPlan: {
                    findFirst: async () => ({ status }),
                    deleteMany: async (args) => {
                        deleteArgs = args;
                        return { count: 1 };
                    }
                }
            }
        })
    });

    assert.deepEqual(await serviceFor("DRAFT").deleteStudyPlan(USER_A, PLAN_ID), { id: PLAN_ID });
    assert.deepEqual(deleteArgs.where, {
        id: PLAN_ID,
        userId: USER_A,
        status: { in: ["DRAFT", "ARCHIVED"] }
    });
    assert.deepEqual(await serviceFor("ARCHIVED").deleteStudyPlan(USER_A, PLAN_ID), { id: PLAN_ID });
});

test("delete rejects missing, other-user, and ACTIVE plans without deleting", async () => {
    let deleteCalls = 0;
    const serviceFor = (plan) => createStudyPlanService({
        prismaClient: createPrismaMock({
            transaction: {
                studyPlan: {
                    findFirst: async ({ where }) => plan && plan.userId === where.userId ? plan : null,
                    deleteMany: async () => {
                        deleteCalls += 1;
                        return { count: 1 };
                    }
                }
            }
        })
    });

    await assertServiceError(serviceFor(null).deleteStudyPlan(USER_A, PLAN_ID), "NOT_FOUND", 404);
    await assertServiceError(
        serviceFor({ status: "DRAFT", userId: USER_B }).deleteStudyPlan(USER_A, PLAN_ID),
        "NOT_FOUND",
        404
    );
    await assertServiceError(
        serviceFor({ status: "ACTIVE", userId: USER_A }).deleteStudyPlan(USER_A, PLAN_ID),
        "INVALID_STATE",
        409
    );
    assert.equal(deleteCalls, 0);
});

test("update transaction failures propagate and unique violations are mapped safely", async () => {
    const prismaClient = createPrismaMock({
        $transaction: async () => {
            const error = new Error("database index details");
            error.code = "P2002";
            throw error;
        }
    });
    const service = createStudyPlanService({ prismaClient });

    await assert.rejects(service.updateStudyPlan(USER_A, PLAN_ID, validInput()), (error) => {
        assert.equal(error.code, "CONFLICT");
        assert.equal(error.status, 409);
        assert.doesNotMatch(error.message, /database index/i);
        return true;
    });
});
