const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const createApp = require("../src/app");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");
const {
    createStudyPlanService,
    StudyPlanServiceError
} = require("../src/services/studyPlanService");
const { getNextSessionDate } = require("../src/controllers/studyPlanController");
const {
    createScheduleCompletionService,
    ScheduleCompletionServiceError
} = require("../src/services/scheduleCompletionService");
const {
    StudyScheduleError,
    generateStudySchedulePreview
} = require("../src/services/studyScheduleService");

const TEST_SECRET = "study-plan-routes-test-secret-with-at-least-32-bytes";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCHEDULE_ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VALID_INPUT = {
    title: "Fall Semester Plan",
    startDate: "2026-11-16",
    endDate: "2026-12-20",
    weeklyTargetMinutes: 1200,
    studyDaysPerWeek: 5,
    subjects: [
        { name: "Mathematics", targetMinutesPerWeek: 720 },
        { name: "Physics", targetMinutesPerWeek: 480 }
    ]
};
const SCHEDULE_PREVIEW_INPUT = {
    plan: { weeklyTargetMinutes: 600, studyDaysPerWeek: 4 },
    subjects: [{ id: "subject-a", name: "Mathematics", targetMinutesPerWeek: 600 }],
    studyDays: ["MON", "TUE", "WED", "THU"],
    scheduleSettings: {
        availabilityWindows: ["MON", "TUE", "WED", "THU"].map((dayOfWeek) => ({
            dayOfWeek,
            startMinuteOfDay: 540,
            endMinuteOfDay: 900
        }))
    }
};

process.env.JWT_SECRET = TEST_SECRET;

function tokenFor(userId = USER_A) {
    return jwt.sign({}, TEST_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        expiresIn: "1h",
        issuer: JWT_ISSUER,
        subject: userId
    });
}

function createMockService(overrides = {}) {
    return {
        createStudyPlan: async () => ({ id: PLAN_ID, status: "DRAFT" }),
        listStudyPlans: async () => [],
        getActiveStudyPlan: async () => null,
        getStudyPlanById: async () => ({ id: PLAN_ID }),
        updateStudyPlan: async () => ({ id: PLAN_ID }),
        replaceStudySchedule: async () => ({ id: PLAN_ID }),
        deleteStudyPlan: async () => ({ id: PLAN_ID }),
        ...overrides
    };
}

async function withServer(
    studyPlanService,
    run,
    studyScheduleService,
    prismaClient,
    scheduleCompletionService
) {
    const server = createApp({
        studyPlanService,
        studyScheduleService,
        prismaClient,
        scheduleCompletionService
    }).listen(0);
    await once(server, "listening");
    const address = server.address();
    const request = (path, options = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, options);

    try {
        await run(request);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

function jsonRequest(method, body, userId = USER_A) {
    return {
        method,
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tokenFor(userId)}`
        },
        body: JSON.stringify(body)
    };
}

function authRequest(userId = USER_A) {
    return { headers: { authorization: `Bearer ${tokenFor(userId)}` } };
}

function planError(message, code, status) {
    return new StudyPlanServiceError(message, code, status);
}

function createOwnerScopedPrismaMock() {
    const plans = [];
    const matchesWhere = (plan, where) =>
        Object.entries(where).every(([key, value]) => plan[key] === value);
    const findFirst = async ({ where }) => plans.find((plan) => matchesWhere(plan, where)) || null;
    const transaction = {
        studyPlan: {
            findFirst,
            updateMany: async ({ where, data }) => {
                const plan = plans.find((record) => matchesWhere(record, where));
                if (!plan) return { count: 0 };
                Object.assign(plan, data, { updatedAt: new Date() });
                return { count: 1 };
            },
            deleteMany: async ({ where }) => {
                const index = plans.findIndex((plan) => matchesWhere(plan, where));
                if (index < 0) return { count: 0 };
                plans.splice(index, 1);
                return { count: 1 };
            }
        },
        studySubject: {
            deleteMany: async () => ({ count: 0 }),
            createMany: async () => ({ count: 0 })
        },
        sessionCompletion: {
            findFirst: async () => null,
            count: async () => 0
        }
    };

    return {
        plans,
        studyPlan: {
            create: async ({ data }) => {
                const plan = {
                    ...data,
                    id: PLAN_ID,
                    createdAt: new Date("2026-11-16T12:00:00.000Z"),
                    updatedAt: new Date("2026-11-16T12:00:00.000Z"),
                    subjects: data.subjects.create.map((subject, index) => ({
                        ...subject,
                        id: `subject-${index}`,
                        planId: PLAN_ID,
                        scheduleItems: []
                    }))
                };
                plans.push(plan);
                return plan;
            },
            findFirst,
            findMany: async ({ where }) => plans.filter((plan) => matchesWhere(plan, where))
        },
        $transaction: async (callback) => callback(transaction)
    };
}

test("POST creates a plan for the authenticated caller and returns 201", async () => {
    let received;
    const service = createMockService({
        createStudyPlan: async (...args) => {
            received = args;
            return {
                id: PLAN_ID,
                status: "DRAFT",
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-12-20T00:00:00.000Z"),
                subjects: []
            };
        }
    });

    await withServer(service, async (request) => {
        const response = await request("/api/study-plans", jsonRequest("POST", {
            ...VALID_INPUT,
            userId: USER_B,
            status: "ACTIVE"
        }));

        assert.equal(response.status, 400);
        assert.equal(received, undefined);

        const created = await request("/api/study-plans", jsonRequest("POST", VALID_INPUT));
        assert.equal(created.status, 201);
        assert.deepEqual(await created.json(), {
            studyPlan: {
                id: PLAN_ID,
                status: "DRAFT",
                startDate: "2026-11-16",
                endDate: "2026-12-20",
                subjects: [],
                nextSessionDate: null
            }
        });
        assert.deepEqual(received, [USER_A, VALID_INPUT]);
    });
});

test("a plan created by user A is hidden from user B on GET, PATCH, and DELETE", async () => {
    const prismaClient = createOwnerScopedPrismaMock();
    const service = createStudyPlanService({ prismaClient });

    await withServer(service, async (request) => {
        const created = await request("/api/study-plans", jsonRequest("POST", VALID_INPUT, USER_A));
        assert.equal(created.status, 201);
        const { studyPlan } = await created.json();
        assert.equal(studyPlan.userId, USER_A);

        const forbiddenRead = await request(`/api/study-plans/${PLAN_ID}`, authRequest(USER_B));
        assert.equal(forbiddenRead.status, 404);

        const forbiddenUpdate = await request(
            `/api/study-plans/${PLAN_ID}`,
            jsonRequest("PATCH", VALID_INPUT, USER_B)
        );
        assert.equal(forbiddenUpdate.status, 404);

        const forbiddenDelete = await request(`/api/study-plans/${PLAN_ID}`, {
            method: "DELETE",
            headers: authRequest(USER_B).headers
        });
        assert.equal(forbiddenDelete.status, 404);
        assert.equal(prismaClient.plans.length, 1);

        const ownerRead = await request(`/api/study-plans/${PLAN_ID}`, authRequest(USER_A));
        assert.equal(ownerRead.status, 200);
        assert.equal((await ownerRead.json()).studyPlan.userId, USER_A);
    });
});

test("nextSessionDate is the next scheduled date in the plan timezone", () => {
    const plan = {
        timeZone: "Asia/Colombo",
        startDate: new Date("2026-11-21T00:00:00.000Z"),
        endDate: new Date("2026-12-01T00:00:00.000Z"),
        subjects: [{
            scheduleItems: [{
                dayOfWeek: "TUE",
                startMinuteOfDay: 600
            }]
        }]
    };

    assert.equal(
        getNextSessionDate(plan, new Date("2026-11-21T02:00:00.000Z")),
        "2026-11-24"
    );
    assert.equal(
        getNextSessionDate(plan, new Date("2026-11-24T02:00:00.000Z")),
        "2026-11-24"
    );
    assert.equal(
        getNextSessionDate(plan, new Date("2026-11-24T06:00:00.000Z")),
        "2026-12-01"
    );
    assert.equal(getNextSessionDate({ ...plan, subjects: [] }), null);
});

test("GET list and active endpoints return the expected shapes for the caller", async () => {
    const calls = [];
    const service = createMockService({
        listStudyPlans: async (userId) => {
            calls.push(["list", userId]);
            return [{
                id: PLAN_ID,
                startDate: new Date("2026-11-16T00:00:00.000Z"),
                endDate: new Date("2026-12-20T00:00:00.000Z"),
                subjects: []
            }];
        },
        getActiveStudyPlan: async (userId) => {
            calls.push(["active", userId]);
            return null;
        }
    });

    await withServer(service, async (request) => {
        const list = await request("/api/study-plans", authRequest());
        assert.equal(list.status, 200);
        assert.deepEqual(await list.json(), {
            studyPlans: [{
                id: PLAN_ID,
                startDate: "2026-11-16",
                endDate: "2026-12-20",
                subjects: [],
                nextSessionDate: null
            }]
        });

        const active = await request("/api/study-plans/active", authRequest());
        assert.equal(active.status, 200);
        assert.deepEqual(await active.json(), { studyPlan: null });
        assert.deepEqual(calls, [["list", USER_A], ["active", USER_A]]);
    });
});

test("GET by ID returns the plan and hides missing or other-user plans as 404", async () => {
    let requestedBy;
    let shouldReturn = true;
    const service = createMockService({
        getStudyPlanById: async (userId, id) => {
            requestedBy = [userId, id];
            return shouldReturn ? { id } : null;
        }
    });

    await withServer(service, async (request) => {
        const ownPlan = await request(`/api/study-plans/${PLAN_ID}`, authRequest());
        assert.equal(ownPlan.status, 200);
        assert.deepEqual(await ownPlan.json(), {
            studyPlan: { id: PLAN_ID, nextSessionDate: null }
        });
        assert.deepEqual(requestedBy, [USER_A, PLAN_ID]);

        shouldReturn = false;
        const unavailable = await request(`/api/study-plans/${PLAN_ID}`, authRequest(USER_B));
        assert.equal(unavailable.status, 404);
        assert.deepEqual(await unavailable.json(), { error: "Study plan not found" });
        assert.deepEqual(requestedBy, [USER_B, PLAN_ID]);
    });
});

test("GET plan response includes the next scheduled occurrence date", async () => {
    const service = createMockService({
        getStudyPlanById: async () => ({
            id: PLAN_ID,
            startDate: new Date("2099-01-01T00:00:00.000Z"),
            endDate: new Date("2099-01-10T00:00:00.000Z"),
            timeZone: "UTC",
            subjects: [{
                scheduleItems: [{ dayOfWeek: "FRI", startMinuteOfDay: 600 }]
            }]
        })
    });

    await withServer(service, async (request) => {
        const response = await request(`/api/study-plans/${PLAN_ID}`, authRequest());
        assert.equal(response.status, 200);
        assert.equal((await response.json()).studyPlan.nextSessionDate, "2099-01-02");
    });
});

test("PUT and PATCH validate the complete payload and return an updated plan", async () => {
    let received;
    const service = createMockService({
        updateStudyPlan: async (...args) => {
            received = args;
            return { id: PLAN_ID, title: "Updated" };
        }
    });

    await withServer(service, async (request) => {
        const invalid = await request(
            `/api/study-plans/${PLAN_ID}`,
            jsonRequest("PUT", { title: "Incomplete" })
        );
        assert.equal(invalid.status, 400);
        assert.equal(received, undefined);

        const updated = await request(
            `/api/study-plans/${PLAN_ID}`,
            jsonRequest("PUT", VALID_INPUT)
        );
        assert.equal(updated.status, 200);
        assert.deepEqual(await updated.json(), {
            studyPlan: { id: PLAN_ID, title: "Updated", nextSessionDate: null }
        });
        assert.deepEqual(received, [USER_A, PLAN_ID, VALID_INPUT]);

        const patched = await request(
            `/api/study-plans/${PLAN_ID}`,
            jsonRequest("PATCH", VALID_INPUT)
        );
        assert.equal(patched.status, 200);
        assert.deepEqual(received, [USER_A, PLAN_ID, VALID_INPUT]);
    });
});

test("PUT schedule persists the authenticated caller's validated plan schedule", async () => {
    let received;
    const savedPlan = { id: PLAN_ID, subjects: [{ scheduleItems: [] }] };
    const service = createMockService({
        replaceStudySchedule: async (...args) => {
            received = args;
            return savedPlan;
        }
    });
    const schedule = [{
        subjectId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        subjectName: "Mathematics",
        dayOfWeek: "MON",
        startMinuteOfDay: 540,
        durationMinutes: 150,
        kind: "STUDY"
    }];

    await withServer(service, async (request) => {
        const response = await request(
            `/api/study-plans/${PLAN_ID}/schedule`,
            jsonRequest("PUT", { schedule })
        );
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            studyPlan: { ...savedPlan, nextSessionDate: null }
        });
        assert.deepEqual(received, [USER_A, PLAN_ID, { schedule }]);
    });
});

test("DELETE removes an eligible plan and returns 204", async () => {
    let received;
    const service = createMockService({
        deleteStudyPlan: async (...args) => { received = args; }
    });

    await withServer(service, async (request) => {
        const response = await request(`/api/study-plans/${PLAN_ID}`, {
            method: "DELETE",
            headers: authRequest().headers
        });
        assert.equal(response.status, 204);
        assert.equal(await response.text(), "");
        assert.deepEqual(received, [USER_A, PLAN_ID]);
    });
});

test("all endpoints require authentication", async () => {
    const service = createMockService();

    await withServer(service, async (request) => {
        const requests = [
            request("/api/study-plans", { method: "POST", body: JSON.stringify(VALID_INPUT) }),
            request("/api/study-plans"),
            request("/api/study-plans/active"),
            request(`/api/study-plans/${PLAN_ID}`),
            request(`/api/study-plans/${PLAN_ID}`, { method: "PUT", body: JSON.stringify(VALID_INPUT) }),
            request(`/api/study-plans/${PLAN_ID}`, { method: "DELETE" }),
            request(`/api/study-plans/${PLAN_ID}/schedule`, { method: "PUT", body: "{}" }),
            request("/api/study-plans/generate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(SCHEDULE_PREVIEW_INPUT)
            }),
            request(`/api/study-plans/${PLAN_ID}/completions?from=2026-11-16&to=2026-11-18`),
            request("/api/study-plans/not-a-uuid/schedule-items/not-a-uuid/completions/not-a-date", {
                method: "PUT",
                body: JSON.stringify({})
            }),
            request("/api/study-plans/not-a-uuid/schedule-items/not-a-uuid/completions/not-a-date", {
                method: "DELETE"
            })
        ];
        const responses = await Promise.all(requests);
        assert.deepEqual(
            responses.map((response) => response.status),
            [401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401]
        );
    });
});

test("GET completions returns owner-scoped records with date-only occurrence dates", async () => {
    const occurrenceDate = new Date("2026-11-16T00:00:00.000Z");
    const completion = {
        id: "completion-id",
        scheduleItemId: SCHEDULE_ITEM_ID,
        occurrenceDate,
        completedAt: new Date("2026-11-16T12:00:00.000Z"),
        actualDurationMinutes: 45
    };
    const planLookups = [];
    let completionQuery;
    let returnNoCompletions = false;
    const completionService = createScheduleCompletionService({
        prismaClient: {
            studyPlan: {
                findFirst: async ({ where }) => {
                    planLookups.push(where);
                    return where.userId === USER_A ? { id: PLAN_ID } : null;
                }
            },
            sessionCompletion: {
                findMany: async (args) => {
                    completionQuery = args;
                    return returnNoCompletions ? [] : [completion];
                },
                count: async () => returnNoCompletions ? 0 : 1
            }
        }
    });

    await withServer(createMockService(), async (request) => {
        const path = `/api/study-plans/${PLAN_ID}/completions?from=2026-11-16&to=2026-11-18`;
        const response = await request(path, authRequest());
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            completions: [{
                id: "completion-id",
                scheduleItemId: SCHEDULE_ITEM_ID,
                occurrenceDate: "2026-11-16",
                completedAt: "2026-11-16T12:00:00.000Z",
                actualDurationMinutes: 45,
                completed: true
            }],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 }
        });
        assert.deepEqual(completionQuery.where.occurrenceDate, {
            gte: new Date("2026-11-16T00:00:00.000Z"),
            lt: new Date("2026-11-18T00:00:00.000Z")
        });

        const otherUser = await request(path, authRequest(USER_B));
        assert.equal(otherUser.status, 404);
        assert.deepEqual(await otherUser.json(), { error: "Study plan not found" });
        assert.equal(planLookups[1].userId, USER_B);

        returnNoCompletions = true;
        const empty = await request(path, authRequest());
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), {
            completions: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 0 }
        });

        const invalidDate = await request(
            `/api/study-plans/${PLAN_ID}/completions?from=2026-02-30&to=2026-03-01`,
            authRequest()
        );
        assert.equal(invalidDate.status, 400);

        const reversedRange = await request(
            `/api/study-plans/${PLAN_ID}/completions?from=2026-11-18&to=2026-11-16`,
            authRequest()
        );
        assert.equal(reversedRange.status, 400);
        assert.equal(planLookups.length, 3);

        const excessivePage = await request(
            `${path}&page=1301`,
            authRequest()
        );
        assert.equal(excessivePage.status, 400);
        assert.equal(planLookups.length, 3);
    }, undefined, undefined, completionService);
});

test("completion PUT creates or updates and DELETE returns the deleted completion", async () => {
    const calls = [];
    const scheduleCompletionService = {
        upsertScheduleCompletion: async (...args) => {
            calls.push(["upsert", ...args]);
            return {
                id: "completion-id",
                scheduleItemId: args[2],
                occurrenceDate: new Date(`${args[3].occurrenceDate}T00:00:00.000Z`),
                completedAt: new Date("2026-11-16T12:00:00.000Z"),
                actualDurationMinutes: args[3].actualDurationMinutes ?? null
            };
        },
        deleteScheduleCompletion: async (...args) => {
            calls.push(["delete", ...args]);
            return {
                scheduleItemId: args[2],
                occurrenceDate: new Date(`${args[3]}T00:00:00.000Z`)
            };
        }
    };

    await withServer(createMockService(), async (request) => {
        const path = `/api/study-plans/${PLAN_ID}/schedule-items/${SCHEDULE_ITEM_ID}/completions/2026-11-16`;
        const createResponse = await request(path, jsonRequest("PUT", { actualDurationMinutes: 35 }));
        assert.equal(createResponse.status, 200);
        assert.deepEqual(await createResponse.json(), {
            completion: {
                id: "completion-id",
                scheduleItemId: SCHEDULE_ITEM_ID,
                occurrenceDate: "2026-11-16",
                completedAt: "2026-11-16T12:00:00.000Z",
                actualDurationMinutes: 35,
                completed: true
            }
        });

        const updateResponse = await request(path, jsonRequest("PUT", { actualDurationMinutes: null }));
        assert.equal(updateResponse.status, 200);
        assert.equal((await updateResponse.json()).completion.actualDurationMinutes, null);

        const deleteResponse = await request(path, {
            method: "DELETE",
            headers: authRequest().headers
        });
        assert.equal(deleteResponse.status, 200);
        assert.deepEqual(await deleteResponse.json(), {
            completion: {
                scheduleItemId: SCHEDULE_ITEM_ID,
                occurrenceDate: "2026-11-16",
                completed: false
            },
            deleted: true
        });
        assert.deepEqual(calls, [
            [
                "upsert",
                USER_A,
                PLAN_ID,
                SCHEDULE_ITEM_ID,
                { actualDurationMinutes: 35, occurrenceDate: "2026-11-16" }
            ],
            [
                "upsert",
                USER_A,
                PLAN_ID,
                SCHEDULE_ITEM_ID,
                { actualDurationMinutes: null, occurrenceDate: "2026-11-16" }
            ],
            ["delete", USER_A, PLAN_ID, SCHEDULE_ITEM_ID, "2026-11-16"]
        ]);
    }, undefined, undefined, scheduleCompletionService);
});

test("completion endpoints reject invalid IDs, dates, durations, and client identity", async () => {
    let calls = 0;
    const scheduleCompletionService = {
        upsertScheduleCompletion: async () => { calls += 1; },
        deleteScheduleCompletion: async () => { calls += 1; }
    };
    const invalidPaths = [
        "/api/study-plans/not-a-uuid/schedule-items/" + PLAN_ID + "/completions/2026-11-16",
        "/api/study-plans/" + PLAN_ID + "/schedule-items/not-a-uuid/completions/2026-11-16",
        "/api/study-plans/" + PLAN_ID + "/schedule-items/" + SCHEDULE_ITEM_ID + "/completions/2026-02-29"
    ];

    await withServer(createMockService(), async (request) => {
        const invalidResponses = await Promise.all([
            request(invalidPaths[0], jsonRequest("PUT", {})),
            request(invalidPaths[1], jsonRequest("PUT", {})),
            request(invalidPaths[2], jsonRequest("PUT", {})),
            request(invalidPaths[2], { method: "DELETE", headers: authRequest().headers }),
            request(
                `/api/study-plans/${PLAN_ID}/schedule-items/${SCHEDULE_ITEM_ID}/completions/2026-11-16`,
                jsonRequest("PUT", { actualDurationMinutes: 0 })
            ),
            request(
                `/api/study-plans/${PLAN_ID}/schedule-items/${SCHEDULE_ITEM_ID}/completions/2026-11-16`,
                jsonRequest("PUT", { actualDurationMinutes: 20, userId: USER_B })
            )
        ]);
        assert.deepEqual(invalidResponses.map((response) => response.status), [400, 400, 400, 400, 400, 400]);
        assert.equal(calls, 0);
    }, undefined, undefined, scheduleCompletionService);
});

test("completion endpoints map missing records to 404 and preserve cross-user isolation", async () => {
    const calls = [];
    const scheduleCompletionService = {
        upsertScheduleCompletion: async (...args) => {
            calls.push(["upsert", ...args]);
            if (args[0] !== USER_A) {
                throw new ScheduleCompletionServiceError("Study plan not found", "PLAN_NOT_FOUND", 404);
            }
            throw new ScheduleCompletionServiceError(
                "Schedule item not found in the requested study plan",
                "SCHEDULE_ITEM_NOT_FOUND",
                404
            );
        },
        deleteScheduleCompletion: async (...args) => {
            calls.push(["delete", ...args]);
            throw new ScheduleCompletionServiceError(
                "Schedule completion not found",
                "COMPLETION_NOT_FOUND",
                404
            );
        }
    };

    await withServer(createMockService(), async (request) => {
        const path = `/api/study-plans/${PLAN_ID}/schedule-items/${SCHEDULE_ITEM_ID}/completions/2026-11-16`;
        const missingItem = await request(path, jsonRequest("PUT", {}, USER_A));
        assert.equal(missingItem.status, 404);
        assert.deepEqual(await missingItem.json(), {
            error: "Schedule item not found in the requested study plan"
        });

        const otherUser = await request(path, jsonRequest("PUT", {}, USER_B));
        assert.equal(otherUser.status, 404);
        assert.deepEqual(await otherUser.json(), { error: "Study plan not found" });
        assert.equal(calls[1][1], USER_B);

        const missingCompletion = await request(path, {
            method: "DELETE",
            headers: authRequest().headers
        });
        assert.equal(missingCompletion.status, 404);
        assert.deepEqual(await missingCompletion.json(), { error: "Schedule completion not found" });
    }, undefined, undefined, scheduleCompletionService);
});

test("POST /generate returns a deterministic preview without database writes", async () => {
    let receivedInput;
    let databaseWrites = 0;
    const studyScheduleService = {
        generateStudySchedulePreview: async (input) => {
            receivedInput = input;
            return generateStudySchedulePreview(input);
        }
    };
    const prismaClient = {
        studyPlan: {
            create: async () => { databaseWrites += 1; },
            update: async () => { databaseWrites += 1; },
            delete: async () => { databaseWrites += 1; }
        },
        studySubject: {
            create: async () => { databaseWrites += 1; },
            createMany: async () => { databaseWrites += 1; }
        },
        scheduleItem: {
            create: async () => { databaseWrites += 1; },
            createMany: async () => { databaseWrites += 1; }
        }
    };

    await withServer(createMockService(), async (request) => {
        const response = await request(
            "/api/study-plans/generate",
            jsonRequest("POST", SCHEDULE_PREVIEW_INPUT)
        );
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(receivedInput, SCHEDULE_PREVIEW_INPUT);
        assert.equal(body.schedule.length, 4);
        assert.ok(body.schedule.every((session) =>
            session.subjectId === "subject-a" &&
            session.subjectName === "Mathematics" &&
            session.durationMinutes === 150 &&
            session.kind === "STUDY"
        ));
        assert.equal(databaseWrites, 0);
    }, studyScheduleService, prismaClient);
});

test("POST /generate rejects invalid input and client-supplied identity", async () => {
    let calls = 0;
    const studyScheduleService = {
        generateStudySchedulePreview: async (input) => {
            calls += 1;
            return generateStudySchedulePreview(input);
        }
    };

    await withServer(createMockService(), async (request) => {
        const invalidRequests = [
            jsonRequest("POST", { ...SCHEDULE_PREVIEW_INPUT, userId: USER_B }),
            jsonRequest("POST", {
                plan: SCHEDULE_PREVIEW_INPUT.plan,
                subjects: SCHEDULE_PREVIEW_INPUT.subjects,
                studyDays: SCHEDULE_PREVIEW_INPUT.studyDays
            }),
            jsonRequest("POST", [])
        ];
        const responses = await Promise.all(
            invalidRequests.map((options) => request("/api/study-plans/generate", options))
        );

        assert.deepEqual(responses.map((response) => response.status), [400, 400, 400]);
        assert.equal(calls, 0);

        const invalidSchedule = await request(
            "/api/study-plans/generate",
            jsonRequest("POST", {
                ...SCHEDULE_PREVIEW_INPUT,
                studyDays: ["MON", "TUE", "WED"]
            })
        );
        assert.equal(invalidSchedule.status, 400);
        assert.match((await invalidSchedule.json()).error, /Study days/);
        assert.equal(calls, 1);
    }, studyScheduleService);
});

test("POST /generate maps impossible schedules to 422 without exposing internals", async () => {
    const studyScheduleService = {
        generateStudySchedulePreview: async () => {
            throw new StudyScheduleError(
                "Provided availability totals 240 minutes, below the 600-minute weekly target",
                "UNSCHEDULABLE"
            );
        }
    };

    await withServer(createMockService(), async (request) => {
        const response = await request(
            "/api/study-plans/generate",
            jsonRequest("POST", SCHEDULE_PREVIEW_INPUT)
        );
        assert.equal(response.status, 422);
        assert.deepEqual(await response.json(), {
            error: "Provided availability totals 240 minutes, below the 600-minute weekly target"
        });
    }, studyScheduleService);
});

test("GET by ID, PUT, and DELETE reject invalid UUIDs without calling the service", async () => {
    let calls = 0;
    const service = createMockService({
        getStudyPlanById: async () => { calls += 1; },
        updateStudyPlan: async () => { calls += 1; },
        replaceStudySchedule: async () => { calls += 1; },
        deleteStudyPlan: async () => { calls += 1; }
    });

    await withServer(service, async (request) => {
        const responses = await Promise.all([
            request("/api/study-plans/not-a-uuid", authRequest()),
            request("/api/study-plans/not-a-uuid", jsonRequest("PUT", VALID_INPUT)),
            request("/api/study-plans/not-a-uuid/schedule", jsonRequest("PUT", { schedule: [] })),
            request("/api/study-plans/not-a-uuid", {
                method: "DELETE",
                headers: authRequest().headers
            })
        ]);
        assert.deepEqual(responses.map((response) => response.status), [400, 400, 400, 400]);
        assert.equal(calls, 0);
    });
});

test("service errors map to safe 404, 409, and generic 500 responses", async () => {
    const service = createMockService({
        getStudyPlanById: async () => { throw planError("Study plan not found", "NOT_FOUND", 404); },
        updateStudyPlan: async () => { throw planError("Only DRAFT plans can be updated", "INVALID_STATE", 409); },
        deleteStudyPlan: async () => {
            throw new Error("Sensitive Prisma query and record details");
        }
    });

    await withServer(service, async (request) => {
        const missing = await request(`/api/study-plans/${PLAN_ID}`, authRequest());
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { error: "Study plan not found" });

        const conflict = await request(
            `/api/study-plans/${PLAN_ID}`,
            jsonRequest("PUT", VALID_INPUT)
        );
        assert.equal(conflict.status, 409);
        assert.deepEqual(await conflict.json(), { error: "Only DRAFT plans can be updated" });

        const failed = await request(`/api/study-plans/${PLAN_ID}`, {
            method: "DELETE",
            headers: authRequest().headers
        });
        assert.equal(failed.status, 500);
        const failedBody = await failed.json();
        assert.deepEqual(failedBody, { error: "Internal server error" });
        assert.doesNotMatch(JSON.stringify(failedBody), /Sensitive|Prisma/);
    });
});
