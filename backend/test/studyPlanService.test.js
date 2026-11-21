const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createStudyPlanService,
    StudyPlanServiceError
} = require("../src/services/studyPlanService");

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBJECT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUBJECT_B_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

function persistedPlan(overrides = {}) {
    return {
        id: PLAN_ID,
        userId: USER_A,
        status: "DRAFT",
        title: "Fall Semester Plan",
        startDate: new Date("2026-11-16T00:00:00.000Z"),
        endDate: new Date("2026-12-20T00:00:00.000Z"),
        timeZone: "Asia/Colombo",
        weeklyTargetMinutes: 1200,
        studyDaysPerWeek: 5,
        updatedAt: new Date("2026-11-16T12:00:00.000Z"),
        subjects: [
            {
                id: SUBJECT_ID,
                name: "Mathematics",
                code: "",
                color: "#9885E8",
                targetMinutesPerWeek: 720
            },
            {
                id: SUBJECT_B_ID,
                name: "Physics",
                code: "PHY",
                color: "#AABBCC",
                targetMinutesPerWeek: 480
            }
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
        },
        sessionCompletion: {
            findFirst: async () => null,
            count: async () => 0,
            ...(overrides.transaction && overrides.transaction.sessionCompletion)
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
    assert.equal(args.include.subjects.include.scheduleItems, true);
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
    assert.equal(args.include.subjects.include.scheduleItems, true);
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
    const notificationCalls = [];
    const transaction = {};
    const currentPlan = persistedPlan();
    const updatedPlan = persistedPlan({
        title: "Updated Plan",
        weeklyTargetMinutes: 900,
        subjects: [{
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            name: "Chemistry",
            code: "",
            color: "#9885E8",
            targetMinutesPerWeek: 900
        }]
    });
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            $transaction: async (callback) => {
                calls.push("transaction");
                let findFirstCalls = 0;
                return callback(Object.assign(transaction, {
                    studyPlan: {
                        updateMany: async (args) => {
                            calls.push(["updateMany", args]);
                            return { count: 1 };
                        },
                        findFirst: async (args) => {
                            calls.push(["findFirst", args]);
                            findFirstCalls += 1;
                            return findFirstCalls === 1 ? currentPlan : updatedPlan;
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
                    },
                    sessionCompletion: {
                        findFirst: async () => null
                    }
                }));
            }
        }),
        notificationService: {
            createNotification: async (...args) => notificationCalls.push(args)
        }
    });

    const result = await service.updateStudyPlan(USER_A, PLAN_ID, validInput({
        title: "Updated Plan",
        weeklyTargetMinutes: 900,
        subjects: [{ name: "Chemistry", targetMinutesPerWeek: 900 }]
    }));

    assert.equal(result.id, PLAN_ID);
    assert.equal(calls[0], "transaction");
    assert.deepEqual(calls[1][1].where, { id: PLAN_ID, userId: USER_A });
    assert.deepEqual(calls[2][1].where, {
        id: PLAN_ID,
        userId: USER_A,
        status: "DRAFT",
        updatedAt: currentPlan.updatedAt
    });
    assert.equal(calls[2][1].data.title, "Updated Plan");
    assert.deepEqual(calls[3][1], { where: { planId: PLAN_ID } });
    assert.deepEqual(calls[4][1].data, [{
        name: "Chemistry",
        code: "",
        color: "#9885E8",
        targetMinutesPerWeek: 900,
        planId: PLAN_ID
    }]);
    assert.deepEqual(calls[5][1].where, { id: PLAN_ID, userId: USER_A });
    assert.deepEqual(notificationCalls[0][0], {
        userId: USER_A,
        type: "study_plan_updated",
        title: "Study plan updated",
        message: "Updated Plan was updated.",
        actionUrl: `/study-plans/${PLAN_ID}`,
        studyPlanId: PLAN_ID
    });
    assert.equal(notificationCalls[0][1], transaction);
});

test("update prevents subject replacement from cascading completed sessions", async () => {
    let updateAttempted = false;
    let subjectDeletionAttempted = false;
    const service = createStudyPlanService({
        prismaClient: {
            $transaction: async (callback) => callback({
                studyPlan: {
                    findFirst: async () => persistedPlan(),
                    updateMany: async () => {
                        updateAttempted = true;
                        return { count: 1 };
                    }
                },
                sessionCompletion: {
                    findFirst: async (args) => {
                        assert.deepEqual(args.where.scheduleItem.is.subject.is, { planId: PLAN_ID });
                        return { id: "completed-session" };
                    }
                },
                studySubject: {
                    deleteMany: async () => {
                        subjectDeletionAttempted = true;
                    }
                }
            })
        }
    });

    await assertServiceError(
        service.updateStudyPlan(USER_A, PLAN_ID, validInput({
            title: "Updated Plan",
            weeklyTargetMinutes: 900,
            subjects: [{ name: "Chemistry", targetMinutesPerWeek: 900 }]
        })),
        "INVALID_STATE",
        409
    );
    assert.equal(updateAttempted, false);
    assert.equal(subjectDeletionAttempted, false);
});

test("unchanged DRAFT updates perform no writes and create no notification", async () => {
    const currentPlan = persistedPlan();
    const calls = [];
    const service = createStudyPlanService({
        prismaClient: {
            $transaction: async (callback) => callback({
                studyPlan: {
                    findFirst: async (args) => {
                        calls.push(["findFirst", args]);
                        return currentPlan;
                    },
                    updateMany: async () => {
                        calls.push(["updateMany"]);
                        throw new Error("No-op updates must not write");
                    }
                },
                studySubject: {
                    deleteMany: async () => {
                        calls.push(["deleteMany"]);
                        throw new Error("No-op updates must not replace subjects");
                    },
                    createMany: async () => {
                        calls.push(["createMany"]);
                        throw new Error("No-op updates must not replace subjects");
                    }
                }
            })
        },
        notificationService: {
            createNotification: async () => {
                calls.push(["notification"]);
            }
        }
    });
    const input = validInput({
        subjects: [
            { name: "Physics", targetMinutesPerWeek: 480, code: "PHY", color: "#AABBCC" },
            { name: "Mathematics", targetMinutesPerWeek: 720 }
        ]
    });

    const result = await service.updateStudyPlan(USER_A, PLAN_ID, input);

    assert.equal(result, currentPlan);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1].where, { id: PLAN_ID, userId: USER_A });
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

test("replaces a persisted schedule transactionally after validating plan ownership and targets", async () => {
    const calls = [];
    const days = ["MON", "TUE", "WED", "THU"];
    const input = {
        schedule: days.map((dayOfWeek) => ({
            subjectId: SUBJECT_ID,
            subjectName: "Mathematics",
            dayOfWeek,
            startMinuteOfDay: 540,
            durationMinutes: 150,
            kind: "STUDY"
        }))
    };
    const plan = {
        id: PLAN_ID,
        userId: USER_A,
        status: "DRAFT",
        studyDaysPerWeek: 4,
        subjects: [{
            id: SUBJECT_ID,
            name: "Mathematics",
            targetMinutesPerWeek: 600,
            scheduleItems: []
        }]
    };
    const savedPlan = {
        ...plan,
        subjects: [{
            ...plan.subjects[0],
            scheduleItems: input.schedule
        }]
    };
    const transaction = {
        studyPlan: {
            findFirst: async (args) => {
                calls.push(["findFirst", args]);
                return calls.filter(([name]) => name === "findFirst").length === 1
                    ? plan
                    : savedPlan;
            }
        },
        scheduleItem: {
            deleteMany: async (args) => {
                calls.push(["deleteMany", args]);
                return { count: 0 };
            },
            createMany: async (args) => {
                calls.push(["createMany", args]);
                return { count: args.data.length };
            }
        }
    };
    const service = createStudyPlanService({
        prismaClient: {
            $transaction: async (callback) => {
                calls.push(["transaction"]);
                return callback(transaction);
            }
        }
    });

    const result = await service.replaceStudySchedule(USER_A, PLAN_ID, input);

    assert.equal(result, savedPlan);
    assert.deepEqual(calls[0], ["transaction"]);
    assert.deepEqual(calls[1][1].where, { id: PLAN_ID, userId: USER_A });
    assert.deepEqual(calls[2][1], { where: { subjectId: { in: [SUBJECT_ID] } } });
    assert.equal(calls[3][1].data.length, 4);
    assert.equal(calls[3][1].data[0].topics.length, 0);
    assert.deepEqual(calls[4][1].where, { id: PLAN_ID, userId: USER_A });
});

test("schedule replacement rejects invalid schedules, missing ownership, archived plans, and completed history", async () => {
    const days = ["MON", "TUE", "WED", "THU"];
    const schedule = days.map((dayOfWeek) => ({
        subjectId: SUBJECT_ID,
        subjectName: "Mathematics",
        dayOfWeek,
        startMinuteOfDay: 540,
        durationMinutes: 150,
        kind: "STUDY"
    }));
    const planFor = (overrides = {}) => ({
        id: PLAN_ID,
        userId: USER_A,
        status: "DRAFT",
        studyDaysPerWeek: 4,
        subjects: [{
            id: SUBJECT_ID,
            name: "Mathematics",
            targetMinutesPerWeek: 600,
            scheduleItems: [],
            ...overrides.subject
        }],
        ...overrides.plan
    });
    const serviceFor = (plan) => createStudyPlanService({
        prismaClient: {
            $transaction: async (callback) => callback({
                studyPlan: { findFirst: async () => plan },
                scheduleItem: {
                    deleteMany: async () => ({ count: 0 }),
                    createMany: async () => ({ count: 4 })
                }
            })
        }
    });

    await assertServiceError(
        serviceFor(null).replaceStudySchedule(USER_A, PLAN_ID, { schedule }),
        "NOT_FOUND",
        404
    );
    await assertServiceError(
        serviceFor(planFor({ plan: { status: "ARCHIVED" } }))
            .replaceStudySchedule(USER_A, PLAN_ID, { schedule }),
        "INVALID_STATE",
        409
    );
    await assertServiceError(
        serviceFor(planFor()).replaceStudySchedule(USER_A, PLAN_ID, {
            schedule: [{ ...schedule[0], durationMinutes: 149 }, ...schedule.slice(1)]
        }),
        "INVALID_INPUT",
        400
    );
    await assertServiceError(
        serviceFor(planFor({
            subject: { scheduleItems: [{ completions: [{ id: "completion" }] }] }
        })).replaceStudySchedule(USER_A, PLAN_ID, { schedule }),
        "INVALID_STATE",
        409
    );
    await assertServiceError(
        serviceFor(planFor()).replaceStudySchedule(USER_A, PLAN_ID, {
            ...{ schedule },
            userId: USER_B
        }),
        "INVALID_INPUT",
        400
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

test("delete preserves completed history on archived plans", async () => {
    const history = [{ id: "completion-a" }];
    let deleteCalls = 0;
    let historyQuery;
    const service = createStudyPlanService({
        prismaClient: createPrismaMock({
            transaction: {
                studyPlan: {
                    findFirst: async ({ where }) => {
                        assert.deepEqual(where, { id: PLAN_ID, userId: USER_A });
                        return { status: "ARCHIVED" };
                    },
                    deleteMany: async () => {
                        deleteCalls += 1;
                        history.length = 0;
                        return { count: 1 };
                    }
                },
                sessionCompletion: {
                    count: async (args) => {
                        historyQuery = args;
                        return history.length;
                    }
                }
            }
        })
    });

    await assertServiceError(
        service.deleteStudyPlan(USER_A, PLAN_ID),
        "INVALID_STATE",
        409
    );
    assert.deepEqual(historyQuery.where.scheduleItem.is.subject.is, {
        planId: PLAN_ID,
        plan: { is: { id: PLAN_ID, userId: USER_A } }
    });
    assert.equal(deleteCalls, 0);
    assert.deepEqual(history, [{ id: "completion-a" }]);
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
