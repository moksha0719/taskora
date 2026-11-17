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
            findFirst: async () => ({
                id: PLAN_ID,
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-12-20T00:00:00.000Z")
            }),
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

test("lists owned plan completions with inclusive from and exclusive to dates", async () => {
    const records = [
        {
            id: "before",
            scheduleItemId: SCHEDULE_ITEM_ID,
            occurrenceDate: new Date("2026-11-15T00:00:00.000Z")
        },
        {
            id: "from",
            scheduleItemId: SCHEDULE_ITEM_ID,
            occurrenceDate: new Date("2026-11-16T00:00:00.000Z")
        },
        {
            id: "before-to",
            scheduleItemId: SCHEDULE_ITEM_ID,
            occurrenceDate: new Date("2026-11-17T00:00:00.000Z")
        },
        {
            id: "to",
            scheduleItemId: SCHEDULE_ITEM_ID,
            occurrenceDate: new Date("2026-11-18T00:00:00.000Z")
        }
    ];
    let planQuery;
    let completionQuery;
    const service = createScheduleCompletionService({
        prismaClient: {
            studyPlan: {
                findFirst: async (args) => {
                    planQuery = args;
                    return { id: PLAN_ID };
                }
            },
            sessionCompletion: {
                findMany: async (args) => {
                    completionQuery = args;
                    const { gte, lt } = args.where.occurrenceDate;
                    return records.filter((record) =>
                        record.occurrenceDate >= gte && record.occurrenceDate < lt
                    );
                },
                count: async () => 2
            }
        }
    });

    const result = await service.listScheduleCompletions(
        USER_ID,
        PLAN_ID,
        "2026-11-16",
        "2026-11-18"
    );

    assert.deepEqual(result.completions.map(({ id }) => id), ["from", "before-to"]);
    assert.deepEqual(result.pagination, { page: 1, limit: 100, total: 2, totalPages: 1 });
    assert.deepEqual(planQuery.where, { id: PLAN_ID, userId: USER_ID });
    assert.deepEqual(completionQuery.where.occurrenceDate, {
        gte: new Date("2026-11-16T00:00:00.000Z"),
        lt: new Date("2026-11-18T00:00:00.000Z")
    });
    assert.deepEqual(completionQuery.where.scheduleItem, {
        is: {
            subject: {
                is: {
                    planId: PLAN_ID,
                    plan: { is: { id: PLAN_ID, userId: USER_ID } }
                }
            }
        }
    });
    assert.deepEqual(completionQuery.orderBy, [
        { occurrenceDate: "asc" },
        { scheduleItemId: "asc" }
    ]);
    assert.equal(completionQuery.skip, 0);
    assert.equal(completionQuery.take, 100);
});

test("does not query completions for a plan not owned by the caller", async () => {
    let completionQueries = 0;
    const service = createScheduleCompletionService({
        prismaClient: {
            studyPlan: {
                findFirst: async ({ where }) => {
                    assert.deepEqual(where, { id: PLAN_ID, userId: USER_ID });
                    return null;
                }
            },
            sessionCompletion: {
                findMany: async () => {
                    completionQueries += 1;
                    return [];
                },
                count: async () => 0
            }
        }
    });

    await serviceError(
        service.listScheduleCompletions(USER_ID, PLAN_ID, "2026-11-16", "2026-11-18"),
        "PLAN_NOT_FOUND",
        404
    );
    assert.equal(completionQueries, 0);
});

test("returns an empty list when no completions match", async () => {
    const service = createScheduleCompletionService({
        prismaClient: {
            studyPlan: { findFirst: async () => ({ id: PLAN_ID }) },
            sessionCompletion: {
                findMany: async () => [],
                count: async () => 0
            }
        }
    });

    assert.deepEqual(
        await service.listScheduleCompletions(USER_ID, PLAN_ID, "2026-11-16", "2026-11-18"),
        {
            completions: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 0 }
        }
    );
});

test("rejects malformed, non-increasing, and overly broad completion date ranges before querying", async () => {
    let queries = 0;
    const service = createScheduleCompletionService({
        prismaClient: {
            studyPlan: {
                findFirst: async () => {
                    queries += 1;
                    return { id: PLAN_ID };
                }
            },
            sessionCompletion: {
                findMany: async () => {
                    queries += 1;
                    return [];
                },
                count: async () => 0
            }
        }
    });

    await serviceError(
        service.listScheduleCompletions(USER_ID, PLAN_ID, "2026-02-30", "2026-03-01"),
        "INVALID_INPUT",
        400
    );
    await serviceError(
        service.listScheduleCompletions(USER_ID, PLAN_ID, "2026-11-18", "2026-11-16"),
        "INVALID_INPUT",
        400
    );
    await serviceError(
        service.listScheduleCompletions(USER_ID, PLAN_ID, "2026-11-16", "2026-11-16"),
        "INVALID_INPUT",
        400
    );
    await serviceError(
        service.listScheduleCompletions(USER_ID, PLAN_ID, "2025-01-01", "2026-01-02"),
        "INVALID_INPUT",
        400,
        /365 days or fewer/
    );
    assert.equal(queries, 0);
});

test("accepts the maximum completion range and bounds history pagination", async () => {
    let completionQuery;
    const service = createScheduleCompletionService({
        prismaClient: {
            studyPlan: { findFirst: async () => ({ id: PLAN_ID }) },
            sessionCompletion: {
                findMany: async (args) => {
                    completionQuery = args;
                    return [];
                },
                count: async () => 0
            }
        }
    });

    const result = await service.listScheduleCompletions(
        USER_ID,
        PLAN_ID,
        "2026-01-01",
        "2027-01-01",
        { page: "1300", limit: "100" }
    );

    assert.deepEqual(result.pagination, { page: 1300, limit: 100, total: 0, totalPages: 0 });
    assert.equal(completionQuery.skip, 129900);
    assert.equal(completionQuery.take, 100);

    await serviceError(
        service.listScheduleCompletions(
            USER_ID,
            PLAN_ID,
            "2026-01-01",
            "2027-01-01",
            { page: "1301", limit: "100" }
        ),
        "INVALID_INPUT",
        400
    );
    await serviceError(
        service.listScheduleCompletions(
            USER_ID,
            PLAN_ID,
            "2026-01-01",
            "2027-01-01",
            { page: "1", limit: "101" }
        ),
        "INVALID_INPUT",
        400
    );
});

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
                            return {
                                id: PLAN_ID,
                                startDate: new Date("2026-11-16T00:00:00.000Z"),
                                endDate: new Date("2026-12-20T00:00:00.000Z")
                            };
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
    assert.deepEqual(calls[1][1].select, {
        id: true,
        startDate: true,
        endDate: true
    });
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

test("accepts completion occurrences on both inclusive plan boundary dates", async () => {
    const savedDates = [];
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                sessionCompletion: {
                    upsert: async ({ create }) => {
                        savedDates.push(create.occurrenceDate.toISOString().slice(0, 10));
                        return create;
                    }
                }
            }
        })
    });

    await service.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
        occurrenceDate: "2026-11-16"
    });
    await service.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
        occurrenceDate: "2026-12-20"
    });

    assert.deepEqual(savedDates, ["2026-11-16", "2026-12-20"]);
});

test("rejects completion occurrences outside the plan date range", async () => {
    let upsertCalls = 0;
    const service = createScheduleCompletionService({
        prismaClient: createPrismaMock({
            transaction: {
                sessionCompletion: {
                    upsert: async () => {
                        upsertCalls += 1;
                    }
                }
            }
        })
    });

    for (const occurrenceDate of ["2026-11-15", "2026-12-21"]) {
        await serviceError(
            service.upsertScheduleCompletion(USER_ID, PLAN_ID, SCHEDULE_ITEM_ID, {
                occurrenceDate
            }),
            "INVALID_INPUT",
            400,
            /within the study plan date range/
        );
    }
    assert.equal(upsertCalls, 0);
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
