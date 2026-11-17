const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const {
    createAiConversationService,
    validateAssistantOutput
} = require("../src/services/aiConversationService");
const {
    createBrainDumpWorkflowService,
    BrainDumpWorkflowServiceError
} = require("../src/services/brainDumpWorkflowService");
const { createTaskService } = require("../src/services/taskService");
const { AiConversationServiceError } = require("../src/services/aiConversationService");

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("assistant action output rejects unsupported fields and invalid task values", () => {
    const outputs = [
        JSON.stringify({
            response: "Suggested action",
            proposals: [{ type: "RUN_SQL", payload: { query: "SELECT 1" } }]
        }),
        JSON.stringify({
            response: "Suggested action",
            proposals: [{ type: "CREATE_TASK", payload: { title: "x".repeat(121) } }]
        }),
        JSON.stringify({
            response: "Suggested action",
            proposals: [{ type: "CREATE_TASK", payload: { title: "Task", status: "COMPLETED" } }]
        })
    ];

    for (const output of outputs) {
        assert.throws(
            () => validateAssistantOutput(output),
            (error) => error instanceof AiConversationServiceError && error.status === 502
        );
    }
});

function createMemoryPrisma() {
    const state = {
        conversations: [],
        messages: [],
        assistantProposals: [],
        brainDumps: [],
        brainDumpProposals: [],
        tasks: []
    };

    const client = {
        aiConversation: {
            create: async ({ data }) => {
                const now = new Date();
                const conversation = {
                    id: CONVERSATION_ID,
                    createdAt: now,
                    updatedAt: now,
                    ...data
                };
                state.conversations.push(conversation);
                return conversation;
            },
            findFirst: async ({ where, include }) => {
                const conversation = state.conversations.find(
                    (item) => item.id === where.id && item.userId === where.userId
                );
                if (!conversation) {
                    return null;
                }
                if (!include) {
                    return conversation;
                }
                return {
                    ...conversation,
                    ...(include.messages
                        ? {
                            messages: state.messages
                                .filter((item) => item.conversationId === conversation.id)
                                .sort((left, right) => left.createdAt - right.createdAt)
                        }
                        : {}),
                    ...(include.proposals
                        ? {
                            proposals: state.assistantProposals.filter(
                                (item) => item.conversationId === conversation.id
                            )
                        }
                        : {})
                };
            },
            updateMany: async ({ where, data }) => {
                const conversation = state.conversations.find(
                    (item) => item.id === where.id && item.userId === where.userId
                );
                if (!conversation) {
                    return { count: 0 };
                }
                Object.assign(conversation, data);
                return { count: 1 };
            }
        },
        aiMessage: {
            create: async ({ data }) => {
                const message = { id: randomUUID(), createdAt: new Date(), ...data };
                state.messages.push(message);
                return message;
            }
        },
        assistantProposal: {
            create: async ({ data }) => {
                const proposal = {
                    id: randomUUID(),
                    status: "PENDING",
                    createdAt: new Date(),
                    ...data
                };
                state.assistantProposals.push(proposal);
                return proposal;
            },
            findFirst: async ({ where }) => state.assistantProposals.find(
                (item) => item.id === where.id && item.userId === where.userId
            ) || null,
            updateMany: async ({ where, data }) => {
                const proposal = state.assistantProposals.find((item) =>
                    item.id === where.id &&
                    item.userId === where.userId &&
                    item.status === where.status &&
                    (!where.expiresAt || item.expiresAt > where.expiresAt.gt)
                );
                if (!proposal) {
                    return { count: 0 };
                }
                Object.assign(proposal, data);
                return { count: 1 };
            },
            update: async ({ where, data }) => {
                const proposal = state.assistantProposals.find((item) => item.id === where.id);
                Object.assign(proposal, data);
                return proposal;
            }
        },
        brainDump: {
            create: async ({ data }) => {
                const now = new Date();
                const brainDump = {
                    id: randomUUID(),
                    createdAt: now,
                    updatedAt: now,
                    userId: data.userId,
                    inputText: data.inputText,
                    summary: data.summary
                };
                state.brainDumps.push(brainDump);
                const proposals = data.proposals.create.map((input) => {
                    const proposal = {
                        id: randomUUID(),
                        brainDumpId: brainDump.id,
                        userId: brainDump.userId,
                        status: "PENDING",
                        createdAt: now,
                        ...input
                    };
                    state.brainDumpProposals.push(proposal);
                    return proposal;
                });
                return { ...brainDump, proposals };
            },
            findFirst: async ({ where, include }) => {
                const brainDump = state.brainDumps.find(
                    (item) => item.id === where.id && item.userId === where.userId
                );
                if (!brainDump) {
                    return null;
                }
                return include
                    ? {
                        ...brainDump,
                        proposals: state.brainDumpProposals.filter(
                            (item) => item.brainDumpId === brainDump.id
                        )
                    }
                    : brainDump;
            }
        },
        brainDumpTaskProposal: {
            findFirst: async ({ where }) => state.brainDumpProposals.find(
                (item) =>
                    item.id === where.id &&
                    item.brainDumpId === where.brainDumpId &&
                    item.userId === where.userId
            ) || null,
            updateMany: async ({ where, data }) => {
                const proposal = state.brainDumpProposals.find((item) =>
                    item.id === where.id &&
                    item.brainDumpId === where.brainDumpId &&
                    item.userId === where.userId &&
                    item.status === where.status
                );
                if (!proposal) {
                    return { count: 0 };
                }
                Object.assign(proposal, data);
                return { count: 1 };
            },
            update: async ({ where, data }) => {
                const proposal = state.brainDumpProposals.find((item) => item.id === where.id);
                Object.assign(proposal, data);
                return proposal;
            }
        },
        task: {
            create: async ({ data, select }) => {
                const task = {
                    id: randomUUID(),
                    status: "TODO",
                    priority: "MEDIUM",
                    description: null,
                    dueDate: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...data
                };
                state.tasks.push(task);
                return Object.fromEntries(Object.keys(select).map((field) => [field, task[field]]));
            }
        },
        $transaction: async (callback) => callback(client)
    };

    return { client, state };
}

test("AI conversations persist messages and proposals; only the owner can explicitly resolve them", async () => {
    const { client, state } = createMemoryPrisma();
    const taskService = createTaskService({ prismaClient: client });
    const aiService = {
        generateContent: async () => JSON.stringify({
            response: "I can prepare these tasks for review.",
            proposals: [
                { type: "CREATE_TASK", payload: { title: "Review notes", priority: "HIGH" } },
                { type: "CREATE_TASK", payload: { title: "Plan study time", priority: "LOW" } }
            ]
        })
    };
    const service = createAiConversationService({
        prismaClient: client,
        aiService,
        taskService,
        clock: () => new Date("2026-11-17T10:00:00.000Z")
    });

    const conversation = await service.createConversation(USER_A, { title: "Study plan" });
    const result = await service.sendMessage(USER_A, conversation.id, { message: "Help me plan" });

    assert.equal(state.messages.length, 2);
    assert.deepEqual(state.messages.map((message) => message.role), ["USER", "ASSISTANT"]);
    assert.equal(result.proposals.length, 2);
    assert.deepEqual(state.assistantProposals.map((proposal) => proposal.status), [
        "PENDING",
        "PENDING"
    ]);
    assert.equal(state.tasks.length, 0);

    await assert.rejects(
        service.getConversation(USER_B, conversation.id),
        (error) => error instanceof AiConversationServiceError && error.status === 404
    );
    await assert.rejects(
        service.approveProposal(USER_B, result.proposals[0].id),
        (error) => error instanceof AiConversationServiceError && error.status === 404
    );
    assert.equal(state.tasks.length, 0);

    const rejected = await service.rejectProposal(USER_A, result.proposals[1].id);
    assert.equal(rejected.proposal.status, "REJECTED");
    assert.equal(state.tasks.length, 0);

    const approved = await service.approveProposal(USER_A, result.proposals[0].id);
    assert.equal(approved.proposal.status, "APPROVED");
    assert.equal(approved.proposal.approvedTaskId, approved.task.id);
    assert.equal(state.tasks.length, 1);
    await assert.rejects(
        service.approveProposal(USER_A, result.proposals[0].id),
        (error) => error instanceof AiConversationServiceError && error.status === 409
    );
    assert.equal(state.tasks.length, 1);
});

test("Brain Dumps persist validated output and create tasks only after owner approval", async () => {
    const { client, state } = createMemoryPrisma();
    const taskService = createTaskService({ prismaClient: client });
    const workflow = createBrainDumpWorkflowService({
        prismaClient: client,
        processingService: {
            processText: async () => ({
                summary: "Prepare for exams.",
                tasks: [
                    { title: "Review biology", priority: "HIGH", dueDate: "2026-12-01" },
                    { title: "Organize notes", priority: "MEDIUM", description: "Sort by topic" }
                ]
            })
        },
        taskService
    });

    const saved = await workflow.createBrainDump(USER_A, "  Biology exam and notes  ");
    assert.equal(saved.inputText, "Biology exam and notes");
    assert.equal(saved.summary, "Prepare for exams.");
    assert.equal(saved.proposals.length, 2);
    assert.equal(state.tasks.length, 0);

    await assert.rejects(
        workflow.getBrainDump(USER_B, saved.id),
        (error) => error instanceof BrainDumpWorkflowServiceError && error.status === 404
    );
    await assert.rejects(
        workflow.approveTaskProposal(USER_B, saved.id, saved.proposals[0].id),
        (error) => error instanceof BrainDumpWorkflowServiceError && error.status === 404
    );
    assert.equal(state.tasks.length, 0);

    const approved = await workflow.approveTaskProposal(
        USER_A,
        saved.id,
        saved.proposals[0].id
    );
    assert.equal(approved.proposal.status, "APPROVED");
    assert.equal(approved.proposal.approvedTaskId, approved.task.id);
    assert.equal(approved.task.dueDate.toISOString(), "2026-12-01T00:00:00.000Z");
    assert.equal(state.tasks.length, 1);
    const rejected = await workflow.rejectTaskProposal(
        USER_A,
        saved.id,
        saved.proposals[1].id
    );
    assert.equal(rejected.status, "REJECTED");
    assert.equal(state.tasks.length, 1);
    await assert.rejects(
        workflow.approveTaskProposal(USER_A, saved.id, saved.proposals[0].id),
        (error) => error instanceof BrainDumpWorkflowServiceError && error.status === 409
    );
    assert.equal(state.tasks.length, 1);
});
