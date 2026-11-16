const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createScheduleCompletionService,
    ScheduleCompletionServiceError
} = require("../src/services/scheduleCompletionService");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCHEDULE_ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OCCURRENCE_DATE = "2026-11-16";

function createPrismaMock(overrides = {}) {
    const transaction = {
        studyPlan: {
            findFirst: async () => ({ id: PLAN_ID }),
            ...(overrides.transaction && overrides.transaction.studyPlan)
        },
        scheduleItem: {
            findFirst: async () => ({ id: SCHEDULE_ITEM_ID }),
            ...(overrides.transaction && overrides.transaction.scheduleItem)
        },
        sessionCompletion: {
            upsert: async () => ({ id: "completion-id" }),
            deleteMany: async () => ({ count: 1 }),
            ...(overrides.transaction && overrides.transaction.sessionCompletion)
        }
    };

    return {
        $transaction: async (callback) => callback(transaction),
        ...overrides,
        transaction
    };
}

function serviceError(promise, code, status, messagePattern) {
    return assert.rejects(promise, (error) => {
        assert.ok(error instanceof ScheduleCompletionServiceError);
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        if (messagePattern) {
            assert.match(error.message, messagePattern);
        }
        return true;
    });
}

test("creates a completion transactionally for an owned schedule item", async () => {
    const calls = [];
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            $transaction: async (callback) => {
                calls.push("transaction");
                return callback({
                    studyPlan: {
                        findFirst: async (args) => {
                            calls.push(["plan", args]);
                            return { id: PLAN_ID };
                        }
                    },
                    scheduleItem: {
                        findFirst: async (args) => {
                            calls.push(["item", args]);
                            return { id: SCHEDULE_ITEM_ID };
                        }
                    },
                    sessionCompletion: {
                        upsert: async (args) => {
                            calls.push(["upsert", args]);
                            return { id: "completion-id", ...args.create };
                        }
                    }
                });
            }
        })
    });

    const completion = await service.upsertScheduleCompletion(
        USER_ID,
        PLAN_ID,
        SCHEDULE_ITEM_ID,
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: 45 }
    );

    assert.equal(completion.id, "completion-id");
    assert.equal(completion.occurrenceDate.toISOString(), "2026-11-16T00:00:00.000Z");
    assert.equal(completion.actualDurationMinutes, 45);
    assert.equal(calls[0], "transaction");
    assert.deepEqual(calls[1][1].where, { id: PLAN_ID, userId: USER_ID });
    assert.deepEqual(calls[2][1].where, {
        id: SCHEDULE_ITEM_ID,
        subject: {
            is: {
                planId: PLAN_ID,
                plan: { is: { id: PLAN_ID, userId: USER_ID } }
            }
        }
    });
    assert.deepEqual(calls[3][1].create, {
        scheduleItemId: SCHEDULE_ITEM_ID,
        occurrenceDate: new Date("2026-11-16T00:00:00.000Z"),
        actualDurationMinutes: 45
    });
});

test("allows null or omitted actual duration", async () => {
    const createArgs = [];
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                sessionCompletion: {
                    upsert: async (args) => {
                        createArgs.push(args);
                        return args.create;
                    }
                }
            }
        })
    });

    await service.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
        occurrenceDate: OCCURRENCE_DATE,
        actualDurationMinutes: null
    });
    await service.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
        occurrenceDate: "2026-11-17"
    });

    assert.deepEqual(createArgs.map((args) => args.create.actualDurationMinutes), [null, null]);
});

test("updates an existing completion for the same item occurrence", async () => {
    const records = new Map();
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                sessionCompletion: {
                    upsert: async ({ where, create, update }) => {
                        const key = `${where.scheduleItemId_occurrenceDate.scheduleItemId}:${where.scheduleItemId_occurrenceDate.occurrenceDate.toISOString()}`;
                        const existing = records.get(key);
                        const completion = existing
                            ? { ...existing, ...update }
                            : { id: "completion-id", ...create };
                        records.set(key, completion);
                        return completion;
                    }
                }
            }
        })
    });

    const first = await service.upsertScheduleCompletion(
        USER_ID,
        PLAN_ID,
        SCHEDULE_ITEM_ID,
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: 30 }
    );
    const updated = await service.upsertScheduleCompletion(
        USER_ID,
        PLAN_ID,
        SCHEDULE_ITEM_ID,
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: 55 }
    );

    assert.equal(first.id, updated.id);
    assert.equal(records.size, 1);
    assert.equal(updated.actualDurationMinutes, 55);
});

test("hides plans not owned by the caller and rejects missing schedule items", async () => {
    let planWhere;
    let itemLookupCount = 0;
    let upsertCount = 0;
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                studyPlan: {
                    findFirst: async ({ where }) => {
                        planWhere = where;
                        return null;
                    }
                },
                scheduleItem: {
                    findFirst: async () => {
                        itemLookupCount += 1;
                        return null;
                    }
                },
                sessionCompletion: {
                    upsert: async () => {
                        upsertCount += 1;
                    }
                }
            }
        })
    });

    await serviceError(
        service.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
            occurrenceDate: OCCURRENCE_DATE
        }),
        "PLAN_NOT_FOUND",
        404,
        /Study plan not found/
    );
    assert.deepEqual(planWhere, { id: PLAN_ID, userId: USER_ID });
    assert.equal(itemLookupCount, 0);

    const ownedPlanService = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                scheduleItem: { findFirst: async () => null },
                sessionCompletion: {
                    upsert: async () => {
                        upsertCount += 1;
                    }
                }
            }
        })
    });
    await serviceError(
        ownedPlanService.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
            occurrenceDate: OCCURRENCE_DATE
        }),
        "SCHEDULE_ITEM_NOT_FOUND",
        404,
        /requested study plan/
    );
    assert.equal(upsertCount, 0);

});

test("deletes only an existing completion after confirming plan and item ownership", async () => {
    let deleteArgs;
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                sessionCompletion: {
                    deleteMany: async (args) => {
                        deleteArgs = args;
                        return { count: 1 };
                    }
                }
            }
        })
    });

    const result = await service.deleteScheduleCompletion(
        USER_ID,
        PLAN_ID,
        SCHEDULE_ITEM_ID,
        OCCURRENCE_DATE
    );

    assert.deepEqual(deleteArgs.where, {
        scheduleItemId: SCHEDULE_ITEM_ID,
        occurrenceDate: new Date("2026-11-16T00:00:00.000Z")
    });
    assert.equal(result.scheduleItemId, SCHEDULE_ITEM_ID);
    assert.equal(result.occurrenceDate.toISOString(), "2026-11-16T00:00:00.000Z");
});

test("reports missing completion records on deletion", async () => {
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                sessionCompletion: {
                    deleteMany: async () => ({ count: 0 })
                }
            }
        })
    });

    await serviceError(
        service.deleteScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, OCCURRENCE_DATE),
        "COMPLETION_NOT_FOUND",
        404,
        /Schedule completion not found/
    );
});

test("rejects malformed dates and invalid actual durations before accessing Prisma", async () => {
    let transactionCalls = 0;
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            $transaction: async (callback) => {
                transactionCalls += 1;
                return callback({});
            }
        })
    });
    const invalidInputs = [
        { occurrenceDate: "2026-02-29", actualDurationMinutes: 30 },
        { occurrenceDate: "2026-11-16T00:00:00Z", actualDurationMinutes: 30 },
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: 0 },
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: -1 },
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: 1.5 },
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: 2147483648 },
        { occurrenceDate: OCCURRENCE_DATE, actualDurationMinutes: "30" },
        { occurrenceDate: OCCURRENCE_DATE, unexpected: true }
    ];

    for (const input of invalidInputs) {
        await serviceError(
            service.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, input),
            "INVALID_INPUT",
            400
        );
    }
    assert.equal(transactionCalls, 0);
});

test("rejects invalid IDs, invalid deletion dates, and maps unique-constraint errors", async () => {
    let transactionCalls = 0;
    const invalidIdService = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            $transaction: async () => {
                transactionCalls += 1;
            }
        })
    });
    await serviceError(
        invalidIdService.upsertScheduleCompletion("not-a-uuid", PLAN_ID, SCHEDULE_ITEM_ID, {
            occurrenceDate: OCCURRENCE_DATE
        }),
        "INVALID_INPUT",
        400
    );
    await serviceError(
        invalidIdService.deleteScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, "2026-04-31"),
        "INVALID_INPUT",
        400
    );
    assert.equal(transactionCalls, 0);

    const conflictService = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                sessionCompletion: {
                    upsert: async () => {
                        const error = new Error("database index details");
                        error.code = "P2002";
                        throw error;
                    }
                }
            }
        })
    });
    await serviceError(
        conflictService.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
            occurrenceDate: OCCURRENCE_DATE
        }),
        "CONFLICT",
        409,
        /already exists/
    );
});
