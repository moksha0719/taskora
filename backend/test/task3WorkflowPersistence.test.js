const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const {
    createAiConversationService,
    validateAssistantOutput
} = require("../src/services/aiConversationService");
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
        }),
        "I can help you with that. Here are some ideas."
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
    let receivedPrompt;
    let receivedGenerationConfig;
    const aiService = {
        generateContent: async (prompt, generationConfig) => {
            receivedPrompt = prompt;
            receivedGenerationConfig = generationConfig;
            return JSON.stringify({
                response: "I can prepare these tasks for review.",
                proposals: [
                    { type: "CREATE_TASK", payload: { title: "Review notes", priority: "HIGH" } },
                    { type: "CREATE_TASK", payload: { title: "Plan study time", priority: "LOW" } }
                ]
            });
        }
    };
    const service = createAiConversationService({
        prismaClient: client,
        aiService,
        taskService,
        clock: () => new Date("2026-11-17T10:00:00.000Z")
    });

    const conversation = await service.createConversation(USER_A, { title: "Study plan" });
    const result = await service.sendMessage(USER_A, conversation.id, { message: "Help me plan" });

    assert.match(receivedPrompt, /Return only valid JSON with no Markdown fences/);
    assert.match(receivedPrompt, /match any requested task count up to 5/);
    assert.deepEqual(receivedGenerationConfig, { responseMimeType: "application/json" });
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
