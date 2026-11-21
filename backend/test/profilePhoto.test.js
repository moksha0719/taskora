"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");
const test = require("node:test");
const createApp = require("../src/app");
const { JWT_AUDIENCE, JWT_ISSUER } = require("../src/config/auth");
const { createProfilePhotoStorage } = require("../src/services/profilePhotoStorage");

const TEST_SECRET = "test-only-profile-photo-secret-with-32-bytes";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
process.env.JWT_SECRET = TEST_SECRET;

const IMAGE_FIXTURES = [
    {
        contentType: "image/jpeg",
        bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        extension: "jpg"
    },
    {
        contentType: "image/png",
        bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII=", "base64"),
        extension: "png"
    },
    {
        contentType: "image/webp",
        bytes: Buffer.from("524946460000000057454250", "hex"),
        extension: "webp"
    }
];

function tokenFor(userId = USER_ID) {
    return jwt.sign({}, TEST_SECRET, {
        algorithm: "HS256",
        audience: JWT_AUDIENCE,
        expiresIn: "1h",
        issuer: JWT_ISSUER,
        subject: userId
    });
}

function createPrismaMock() {
    const user = { id: USER_ID, name: "Test User", email: "photo@example.test", avatar: null };
    const updateCalls = [];
    return {
        user,
        updateCalls,
        prisma: {
            user: {
                findUnique: async ({ where }) => where.id === USER_ID
                    ? { id: user.id, avatar: user.avatar }
                    : null,
                update: async ({ where, data }) => {
                    updateCalls.push({ where, data });
                    Object.assign(user, data);
                    return { ...user, role: "STUDENT", bio: null, major: null };
                }
            }
        }
    };
}

async function createTestApp(prismaClient, storage) {
    const app = createApp({
        prismaClient,
        profilePhotoStorage: storage,
        notificationService: { createNotification: async () => ({}) },
        env: { NODE_ENV: "test" }
    });
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    return {
        request: (url, options = {}) =>
            fetch(`http://127.0.0.1:${server.address().port}${url}`, options),
        close: () => new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        })
    };
}

async function withPhotoFixture(run) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "taskora-profile-photo-"));
    try {
        await run(directory);
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
}

function uploadRequest(file, token = tokenFor()) {
    return {
        method: "PUT",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": file.contentType
        },
        body: file.bytes
    };
}

test("authenticated users can save supported photos and the avatar URL persists across app restarts", async () => {
    await withPhotoFixture(async (directory) => {
        const { prisma, user, updateCalls } = createPrismaMock();
        const storage = createProfilePhotoStorage({ directory });
        const app = await createTestApp(prisma, storage);
        let lastBytes;

        try {
            for (const fixture of IMAGE_FIXTURES) {
                const response = await app.request(
                    "/api/auth/profile/avatar",
                    uploadRequest(fixture)
                );
                assert.equal(response.status, 200);
                const { user: updatedUser } = await response.json();
                assert.equal(updatedUser.avatar, user.avatar);
                assert.match(user.avatar, new RegExp(
                    `^/uploads/profile-photos/${USER_ID}-[0-9a-f-]{36}\\.${fixture.extension}$`
                ));
                assert.equal(updateCalls.at(-1).where.id, USER_ID);

                const imageResponse = await app.request(user.avatar);
                assert.equal(imageResponse.status, 200);
                assert.equal(imageResponse.headers.get("content-type"), fixture.contentType);
                lastBytes = Buffer.from(await imageResponse.arrayBuffer());
                assert.deepEqual(lastBytes, fixture.bytes);
            }
        } finally {
            await app.close();
        }

        const restartedApp = await createTestApp(
            prisma,
            createProfilePhotoStorage({ directory })
        );
        try {
            const persistedResponse = await restartedApp.request(user.avatar);
            assert.equal(persistedResponse.status, 200);
            assert.deepEqual(Buffer.from(await persistedResponse.arrayBuffer()), lastBytes);
        } finally {
            await restartedApp.close();
        }
    });
});

test("profile photo upload rejects unsupported and mismatched image types", async () => {
    await withPhotoFixture(async (directory) => {
        const { prisma } = createPrismaMock();
        const app = await createTestApp(prisma, createProfilePhotoStorage({ directory }));
        try {
            const unsupported = await app.request("/api/auth/profile/avatar", uploadRequest({
                contentType: "image/gif",
                bytes: Buffer.from("GIF89a")
            }));
            assert.equal(unsupported.status, 415);

            const mismatched = await app.request("/api/auth/profile/avatar", uploadRequest({
                contentType: "image/jpeg",
                bytes: IMAGE_FIXTURES.find((fixture) => fixture.contentType === "image/png").bytes
            }));
            assert.equal(mismatched.status, 400);
        } finally {
            await app.close();
        }
        assert.deepEqual(await fs.readdir(directory), []);
    });
});

test("profile photo upload rejects images larger than five megabytes", async () => {
    await withPhotoFixture(async (directory) => {
        const { prisma } = createPrismaMock();
        const app = await createTestApp(prisma, createProfilePhotoStorage({ directory }));
        try {
            const oversized = await app.request(
                "/api/auth/profile/avatar",
                uploadRequest({
                    contentType: "image/png",
                    bytes: Buffer.concat([
                        IMAGE_FIXTURES.find((fixture) => fixture.contentType === "image/png").bytes,
                        Buffer.alloc(5 * 1024 * 1024)
                    ])
                })
            );
            assert.equal(oversized.status, 413);
        } finally {
            await app.close();
        }
        assert.deepEqual(await fs.readdir(directory), []);
    });
});

test("profile photo upload requires authentication and changes only the authenticated user's avatar", async () => {
    await withPhotoFixture(async (directory) => {
        const { prisma, updateCalls } = createPrismaMock();
        const app = await createTestApp(prisma, createProfilePhotoStorage({ directory }));
        try {
            const unauthorized = await app.request(
                "/api/auth/profile/avatar",
                uploadRequest(IMAGE_FIXTURES[0], "")
            );
            assert.equal(unauthorized.status, 401);
            assert.equal(updateCalls.length, 0);

            const otherUser = await app.request(
                "/api/auth/profile/avatar",
                uploadRequest(IMAGE_FIXTURES[0], tokenFor("550e8400-e29b-41d4-a716-446655440002"))
            );
            assert.equal(otherUser.status, 404);
            assert.equal(updateCalls.length, 0);
        } finally {
            await app.close();
        }
        assert.deepEqual(await fs.readdir(directory), []);
    });
});
