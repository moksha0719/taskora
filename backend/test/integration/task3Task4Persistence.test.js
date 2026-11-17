"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const test = require("node:test");

function getSafeTestDatabaseUrl(value) {
    if (!value) {
        return null;
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error("TASKORA_TEST_DATABASE_URL must be a valid PostgreSQL URL");
    }

    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        url.hostname !== "127.0.0.1" ||
        !url.port ||
        !/^taskora_test_[a-z0-9_]+$/.test(databaseName)
    ) {
        throw new Error(
            "PostgreSQL integration tests require a loopback URL and a taskora_test_* database"
        );
    }

    return value;
}

const testDatabaseUrl = getSafeTestDatabaseUrl(process.env.TASKORA_TEST_DATABASE_URL);
if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET = "taskora-task34-postgres-test-only-secret";
}

async function listen(app) {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    return {
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`
    };
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

async function request(baseUrl, method, path, token, body) {
    const headers = {};
    if (token) {
        headers.authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
        headers["content-type"] = "application/json";
    }
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const responseBody = response.status === 204 ? null : await response.json();
    return { response, body: responseBody };
}

async function createUser(baseUrl, label) {
    const email = `${label}-${randomUUID()}@taskora.test`;
    const password = "Taskora-Test-12345";
    const registration = await request(baseUrl, "POST", "/api/auth/register", null, {
        name: `Integration ${label}`,
        email,
        password
    });
    assert.equal(registration.response.status, 202);
    const login = await request(baseUrl, "POST", "/api/auth/login", null, {
        email,
        password
    });
    assert.equal(login.response.status, 200);
    return { email, token: login.body.token, user: login.body.user };
}

function planInput(title) {
    return {
        title,
        startDate: "2026-11-16",
        endDate: "2026-12-20",
        timeZone: "UTC",
        weeklyTargetMinutes: 600,
        studyDaysPerWeek: 4,
        subjects: [
            { name: "Mathematics", targetMinutesPerWeek: 300 },
            { name: "Physics", targetMinutesPerWeek: 300 }
        ]
    };
}

function scheduleFor(plan) {
    const schedule = [];
    for (const dayOfWeek of ["MON", "TUE", "WED", "THU"]) {
        schedule.push({
            subjectId: plan.subjects[0].id,
            subjectName: plan.subjects[0].name,
            dayOfWeek,
            startMinuteOfDay: 480,
            durationMinutes: 75,
            kind: "STUDY"
        });
        schedule.push({
            subjectId: plan.subjects[1].id,
            subjectName: plan.subjects[1].name,
            dayOfWeek,
            startMinuteOfDay: 570,
            durationMinutes: 75,
            kind: "STUDY"
        });
    }
    return schedule;
}

async function createScheduledPlan(baseUrl, token, title) {
    const created = await request(
        baseUrl,
        "POST",
        "/api/study-plans",
        token,
        planInput(title)
    );
    assert.equal(created.response.status, 201);
    const saved = await request(
        baseUrl,
        "PUT",
        `/api/study-plans/${created.body.studyPlan.id}/schedule`,
        token,
        { schedule: scheduleFor(created.body.studyPlan) }
    );
    assert.equal(saved.response.status, 200);
    return saved.body.studyPlan;
}

test("Task 3 and Task 4 persistence, ownership, migration structure, and rollback", {
    skip: testDatabaseUrl
        ? false
        : "Set TASKORA_TEST_DATABASE_URL to a fresh isolated loopback test database"
}, async (t) => {
    const prisma = require("../../src/lib/prisma");
    const createApp = require("../../src/app");
    const { createAiConversationService } = require("../../src/services/aiConversationService");
    const { createBrainDumpWorkflowService } = require("../../src/services/brainDumpWorkflowService");

    const aiService = {
        generateContent: async () => JSON.stringify({
            response: "Review these suggested tasks before accepting them.",
            proposals: [
                { type: "CREATE_TASK", payload: { title: "Review biology", priority: "HIGH" } },
                { type: "CREATE_TASK", payload: { title: "Practice equations", priority: "MEDIUM" } }
            ]
        })
    };
    const brainDumpProcessingService = {
        processText: async () => ({
            summary: "Prepare for the final exams.",
            tasks: [
                {
                    title: "Review chemistry",
                    priority: "HIGH",
                    dueDate: "2026-12-01"
                },
                { title: "Organize notes", priority: "LOW" },
                { title: "Practice questions", priority: "MEDIUM" }
            ]
        })
    };
    const app = createApp({ prismaClient: prisma, aiService, brainDumpProcessingService });
    const server = await listen(app);
    t.after(async () => {
        await close(server.server);
        await prisma.$disconnect();
    });

    const userA = await createUser(server.baseUrl, "task34-a");
    const userB = await createUser(server.baseUrl, "task34-b");

    const conversationResponse = await request(
        server.baseUrl,
        "POST",
        "/api/ai/conversations",
        userA.token,
        { title: "Exam preparation" }
    );
    assert.equal(conversationResponse.response.status, 201);
    const conversationId = conversationResponse.body.conversation.id;
    const messageResponse = await request(
        server.baseUrl,
        "POST",
        `/api/ai/conversations/${conversationId}/messages`,
        userA.token,
        { message: "Help me prepare" }
    );
    assert.equal(messageResponse.response.status, 201);
    assert.equal(messageResponse.body.proposals.length, 2);
    assert.equal(await prisma.aiMessage.count({ where: { conversationId } }), 2);
    assert.equal(await prisma.task.count({ where: { userId: userA.user.id } }), 0);
    await assert.rejects(
        prisma.aiMessage.create({
            data: {
                conversationId,
                userId: userB.user.id,
                role: "USER",
                content: "Cross-owner relationship must fail"
            }
        }),
        (error) => error.code === "P2003"
    );
    assert.equal(
        await prisma.aiMessage.count({
            where: { conversationId, userId: userB.user.id }
        }),
        0
    );

    const conversationRead = await request(
        server.baseUrl,
        "GET",
        `/api/ai/conversations/${conversationId}`,
        userA.token
    );
    assert.equal(conversationRead.response.status, 200);
    assert.equal(conversationRead.body.conversation.messages.length, 2);
    assert.equal(conversationRead.body.conversation.proposals.length, 2);
    assert.equal(
        (await request(
            server.baseUrl,
            "GET",
            `/api/ai/conversations/${conversationId}`,
            userB.token
        )).response.status,
        404
    );
    const aiProposals = messageResponse.body.proposals;
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/ai/proposals/${aiProposals[0].id}/approve`,
            userB.token,
            {}
        )).response.status,
        404
    );
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/ai/proposals/${aiProposals[0].id}/reject`,
            userA.token,
            {}
        )).response.status,
        200
    );
    const approvedAiTask = await request(
        server.baseUrl,
        "POST",
        `/api/ai/proposals/${aiProposals[1].id}/approve`,
        userA.token,
        {}
    );
    assert.equal(approvedAiTask.response.status, 200);
    assert.equal(approvedAiTask.body.task.userId, undefined);
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/ai/proposals/${aiProposals[1].id}/approve`,
            userA.token,
            {}
        )).response.status,
        409
    );
    assert.equal(
        await prisma.assistantProposal.count({
            where: { id: aiProposals[0].id, status: "REJECTED" }
        }),
        1
    );
    assert.equal(
        await prisma.assistantProposal.count({
            where: {
                id: aiProposals[1].id,
                status: "APPROVED",
                approvedTaskId: approvedAiTask.body.task.id
            }
        }),
        1
    );

    const expiredProposal = await prisma.assistantProposal.create({
        data: {
            conversationId,
            userId: userA.user.id,
            actionType: "CREATE_TASK",
            payload: { title: "Expired proposal", priority: "LOW" },
            expiresAt: new Date(Date.now() - 60_000)
        }
    });
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/ai/proposals/${expiredProposal.id}/approve`,
            userA.token,
            {}
        )).response.status,
        409
    );
    assert.equal(
        (await prisma.assistantProposal.findUnique({ where: { id: expiredProposal.id } })).status,
        "EXPIRED"
    );

    const rollbackAiProposal = await prisma.assistantProposal.create({
        data: {
            conversationId,
            userId: userA.user.id,
            actionType: "CREATE_TASK",
            payload: { title: "Rollback proposal", priority: "LOW" },
            expiresAt: new Date(Date.now() + 60_000)
        }
    });
    const rollbackAiService = createAiConversationService({
        prismaClient: prisma,
        aiService,
        taskService: {
            createTask: async () => {
                throw new Error("Injected task creation failure");
            }
        }
    });
    await assert.rejects(
        rollbackAiService.approveProposal(userA.user.id, rollbackAiProposal.id),
        /Injected task creation failure/
    );
    assert.equal(
        (await prisma.assistantProposal.findUnique({
            where: { id: rollbackAiProposal.id }
        })).status,
        "PENDING"
    );

    const brainDumpResponse = await request(
        server.baseUrl,
        "POST",
        "/api/brain-dumps",
        userA.token,
        { text: "Chemistry, notes, and practice questions" }
    );
    assert.equal(brainDumpResponse.response.status, 201);
    const brainDump = brainDumpResponse.body.brainDump;
    assert.equal(brainDump.inputText, "Chemistry, notes, and practice questions");
    assert.equal(brainDump.proposals.length, 3);
    const dueDateProposal = brainDump.proposals.find(
        (proposal) => proposal.title === "Review chemistry"
    );
    const rejectedProposal = brainDump.proposals.find(
        (proposal) => proposal.title === "Organize notes"
    );
    const rollbackProposal = brainDump.proposals.find(
        (proposal) => proposal.title === "Practice questions"
    );
    assert.ok(dueDateProposal);
    assert.ok(rejectedProposal);
    assert.ok(rollbackProposal);
    await assert.rejects(
        prisma.brainDumpTaskProposal.create({
            data: {
                brainDumpId: brainDump.id,
                userId: userB.user.id,
                title: "Cross-owner proposal",
                priority: "LOW"
            }
        }),
        (error) => error.code === "P2003"
    );
    assert.equal(
        (await request(
            server.baseUrl,
            "GET",
            `/api/brain-dumps/${brainDump.id}`,
            userB.token
        )).response.status,
        404
    );
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/brain-dumps/${brainDump.id}/proposals/${dueDateProposal.id}/approve`,
            userB.token,
            {}
        )).response.status,
        404
    );
    const brainDumpApproval = await request(
        server.baseUrl,
        "POST",
        `/api/brain-dumps/${brainDump.id}/proposals/${dueDateProposal.id}/approve`,
        userA.token,
        {}
    );
    assert.equal(brainDumpApproval.response.status, 200);
    assert.equal(
        brainDumpApproval.body.task.dueDate,
        "2026-12-01T00:00:00.000Z"
    );
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/brain-dumps/${brainDump.id}/proposals/${rejectedProposal.id}/reject`,
            userA.token,
            {}
        )).response.status,
        200
    );
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/brain-dumps/${brainDump.id}/proposals/${dueDateProposal.id}/approve`,
            userA.token,
            {}
        )).response.status,
        409
    );

    const rollbackBrainDumpService = createBrainDumpWorkflowService({
        prismaClient: prisma,
        processingService: brainDumpProcessingService,
        taskService: {
            createTask: async () => {
                throw new Error("Injected Brain Dump task creation failure");
            }
        }
    });
    await assert.rejects(
        rollbackBrainDumpService.approveTaskProposal(
            userA.user.id,
            brainDump.id,
            rollbackProposal.id
        ),
        /Injected Brain Dump task creation failure/
    );
    assert.equal(
        (await prisma.brainDumpTaskProposal.findUnique({
            where: { id: rollbackProposal.id }
        })).status,
        "PENDING"
    );

    const planA = await createScheduledPlan(server.baseUrl, userA.token, "Task 4 plan A");
    const planB = await createScheduledPlan(server.baseUrl, userA.token, "Task 4 plan B");
    const planC = await createScheduledPlan(
        server.baseUrl,
        userA.token,
        "Taskora integration activation rollback target"
    );
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/study-plans/${planA.id}/activate`,
            userB.token,
            {}
        )).response.status,
        404
    );
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/study-plans/${planA.id}/activate`,
            userA.token,
            {}
        )).response.status,
        200
    );

    const scheduleItem = planA.subjects[0].scheduleItems[0];
    const completionPath =
        `/api/study-plans/${planA.id}/schedule-items/${scheduleItem.id}/completions/2026-11-18`;
    const completionResponse = await request(
        server.baseUrl,
        "PUT",
        completionPath,
        userA.token,
        { actualDurationMinutes: 40 }
    );
    assert.equal(completionResponse.response.status, 200);
    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/study-plans/${planB.id}/activate`,
            userA.token,
            {}
        )).response.status,
        200
    );
    const switchedPlans = await prisma.studyPlan.findMany({
        where: { userId: userA.user.id, status: "ACTIVE" }
    });
    assert.deepEqual(switchedPlans.map((plan) => plan.id), [planB.id]);
    assert.equal(
        await prisma.sessionCompletion.count({ where: { scheduleItemId: scheduleItem.id } }),
        1
    );
    assert.equal(
        await prisma.scheduleItem.count({ where: { subject: { planId: planA.id } } }),
        8
    );

    let triggerInstalled = false;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION taskora_test_fail_plan_activation()
            RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NEW.title = 'Taskora integration activation rollback target'
                    AND NEW.status = 'ACTIVE' THEN
                    RAISE EXCEPTION 'Injected activation failure' USING ERRCODE = 'P0001';
                END IF;
                RETURN NEW;
            END;
            $$;
        `);
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER taskora_test_fail_plan_activation_trigger
            BEFORE UPDATE ON "StudyPlan"
            FOR EACH ROW EXECUTE FUNCTION taskora_test_fail_plan_activation();
        `);
        triggerInstalled = true;

        assert.equal(
            (await request(
                server.baseUrl,
                "POST",
                `/api/study-plans/${planC.id}/activate`,
                userA.token,
                {}
            )).response.status,
            500
        );
        assert.equal(
            (await prisma.studyPlan.findUnique({ where: { id: planB.id } })).status,
            "ACTIVE"
        );
        assert.equal(
            (await prisma.studyPlan.findUnique({ where: { id: planC.id } })).status,
            "DRAFT"
        );
    } finally {
        if (triggerInstalled) {
            await prisma.$executeRawUnsafe(`
                DROP TRIGGER taskora_test_fail_plan_activation_trigger ON "StudyPlan";
            `);
        }
        await prisma.$executeRawUnsafe(`
            DROP FUNCTION IF EXISTS taskora_test_fail_plan_activation();
        `);
    }

    assert.equal(
        (await request(
            server.baseUrl,
            "POST",
            `/api/study-plans/${planB.id}/deactivate`,
            userA.token,
            {}
        )).response.status,
        200
    );
    assert.equal(
        await prisma.scheduleItem.count({ where: { subject: { planId: planB.id } } }),
        8
    );

    const migrationRows = await prisma.$queryRaw`
        SELECT migration_name
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY migration_name
    `;
    assert.deepEqual(
        migrationRows.map((row) => row.migration_name),
        [
            "20261115162629_init_user_task_models",
            "20261116153600_add_study_planner",
            "20261116190000_add_notifications",
            "20261117101500_add_ai_and_brain_dump_workflows"
        ]
    );

    const expectedTables = [
        "AiConversation",
        "AiMessage",
        "AssistantProposal",
        "BrainDump",
        "BrainDumpTaskProposal"
    ];
    const tableRows = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
            AND table_name IN (
                'AiConversation',
                'AiMessage',
                'AssistantProposal',
                'BrainDump',
                'BrainDumpTaskProposal'
            )
    `;
    assert.deepEqual(
        tableRows.map((row) => row.table_name).sort(),
        expectedTables.sort()
    );

    const expectedColumns = {
        AiConversation: ["id", "userId", "title", "createdAt", "updatedAt"],
        AiMessage: ["id", "conversationId", "userId", "role", "content", "createdAt"],
        AssistantProposal: [
            "id",
            "conversationId",
            "userId",
            "actionType",
            "payload",
            "status",
            "expiresAt",
            "resolvedAt",
            "approvedTaskId",
            "createdAt"
        ],
        BrainDump: ["id", "userId", "inputText", "summary", "createdAt", "updatedAt"],
        BrainDumpTaskProposal: [
            "id",
            "brainDumpId",
            "userId",
            "title",
            "description",
            "priority",
            "dueDate",
            "status",
            "resolvedAt",
            "approvedTaskId",
            "createdAt"
        ]
    };
    for (const [tableName, columns] of Object.entries(expectedColumns)) {
        const rows = await prisma.$queryRaw`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${tableName}
        `;
        assert.deepEqual(
            rows.map((row) => row.column_name).sort(),
            columns.sort()
        );
    }

    const enumRows = await prisma.$queryRaw`
        SELECT type.typname AS enum_name, value.enumlabel AS enum_value
        FROM pg_type AS type
        JOIN pg_enum AS value ON value.enumtypid = type.oid
        WHERE type.typname IN (
            'AssistantMessageRole',
            'AssistantActionType',
            'ActionProposalStatus'
        )
        ORDER BY type.typname, value.enumsortorder
    `;
    assert.deepEqual(enumRows, [
        { enum_name: "ActionProposalStatus", enum_value: "PENDING" },
        { enum_name: "ActionProposalStatus", enum_value: "APPROVED" },
        { enum_name: "ActionProposalStatus", enum_value: "REJECTED" },
        { enum_name: "ActionProposalStatus", enum_value: "EXPIRED" },
        { enum_name: "AssistantActionType", enum_value: "CREATE_TASK" },
        { enum_name: "AssistantMessageRole", enum_value: "USER" },
        { enum_name: "AssistantMessageRole", enum_value: "ASSISTANT" }
    ]);

    const expectedIndexes = [
        "AiConversation_pkey",
        "AiConversation_id_userId_key",
        "AiConversation_userId_updatedAt_idx",
        "AiMessage_pkey",
        "AiMessage_conversationId_createdAt_idx",
        "AiMessage_userId_conversationId_createdAt_idx",
        "AssistantProposal_pkey",
        "AssistantProposal_approvedTaskId_key",
        "AssistantProposal_userId_status_createdAt_idx",
        "BrainDump_pkey",
        "BrainDump_id_userId_key",
        "BrainDump_userId_createdAt_idx",
        "BrainDumpTaskProposal_pkey",
        "BrainDumpTaskProposal_approvedTaskId_key",
        "BrainDumpTaskProposal_userId_status_createdAt_idx"
    ];
    const indexRows = await prisma.$queryRaw`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
            AND tablename IN (
                'AiConversation',
                'AiMessage',
                'AssistantProposal',
                'BrainDump',
                'BrainDumpTaskProposal'
            )
    `;
    assert.deepEqual(
        indexRows.map((row) => row.indexname).sort(),
        expectedIndexes.sort()
    );

    const expectedForeignKeys = [
        "AiConversation_userId_fkey",
        "AiMessage_conversationId_userId_fkey",
        "AssistantProposal_conversationId_userId_fkey",
        "AssistantProposal_approvedTaskId_fkey",
        "BrainDump_userId_fkey",
        "BrainDumpTaskProposal_brainDumpId_userId_fkey",
        "BrainDumpTaskProposal_approvedTaskId_fkey"
    ];
    const foreignKeyRows = await prisma.$queryRaw`
        SELECT conname
        FROM pg_constraint
        WHERE contype = 'f'
            AND conname IN (
                'AiConversation_userId_fkey',
                'AiMessage_conversationId_userId_fkey',
                'AssistantProposal_conversationId_userId_fkey',
                'AssistantProposal_approvedTaskId_fkey',
                'BrainDump_userId_fkey',
                'BrainDumpTaskProposal_brainDumpId_userId_fkey',
                'BrainDumpTaskProposal_approvedTaskId_fkey'
            )
    `;
    assert.deepEqual(
        foreignKeyRows.map((row) => row.conname).sort(),
        expectedForeignKeys.sort()
    );

    const persistedClientModule = require("../../build/generated/prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const freshClient = new persistedClientModule.PrismaClient({
        adapter: new PrismaPg({ connectionString: testDatabaseUrl })
    });
    try {
        assert.equal(
            await freshClient.aiConversation.count({
                where: { id: conversationId, userId: userA.user.id }
            }),
            1
        );
        assert.equal(
            await freshClient.aiMessage.count({ where: { conversationId } }),
            2
        );
        assert.equal(
            await freshClient.brainDump.count({
                where: { id: brainDump.id, userId: userA.user.id }
            }),
            1
        );
        assert.equal(
            await freshClient.task.count({
                where: {
                    id: { in: [approvedAiTask.body.task.id, brainDumpApproval.body.task.id] },
                    userId: userA.user.id
                }
            }),
            2
        );
        assert.equal(
            await freshClient.sessionCompletion.count({
                where: { scheduleItemId: scheduleItem.id }
            }),
            1
        );
    } finally {
        await freshClient.$disconnect();
    }
});
