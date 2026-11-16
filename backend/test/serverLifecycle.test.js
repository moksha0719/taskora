const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const express = require("express");
const test = require("node:test");
const { startBackendServer } = require("../src/lib/serverLifecycle");

test("server starts the scheduler after listening and gracefully shuts it down once", async () => {
    const calls = [];
    const processTarget = new EventEmitter();
    const lifecycle = startBackendServer({
        app: express(),
        port: 0,
        processTarget,
        logger: { log: (message) => calls.push(message), error: () => {} },
        notificationScheduler: {
            start: () => calls.push("scheduler-start"),
            stop: async () => calls.push("scheduler-stop")
        },
        prismaClient: {
            $disconnect: async () => calls.push("prisma-disconnect")
        }
    });

    await once(lifecycle.server, "listening");
    assert.deepEqual(calls, [
        "Taskora server running on port 0",
        "scheduler-start"
    ]);

    const firstShutdown = lifecycle.shutdown("SIGTERM");
    const secondShutdown = lifecycle.shutdown("SIGINT");
    await Promise.all([firstShutdown, secondShutdown]);
    assert.deepEqual(calls, [
        "Taskora server running on port 0",
        "scheduler-start",
        "Taskora server shutting down (SIGTERM)",
        "scheduler-stop",
        "prisma-disconnect"
    ]);
    assert.equal(lifecycle.server.listening, false);
});

test("signal handlers trigger graceful shutdown and set failure exit code on errors", async () => {
    const calls = [];
    const processTarget = new EventEmitter();
    processTarget.exitCode = 0;
    const lifecycle = startBackendServer({
        app: express(),
        port: 0,
        processTarget,
        logger: {
            log: () => {},
            error: (...args) => calls.push(args)
        },
        notificationScheduler: {
            start: () => {},
            stop: async () => {
                throw new Error("private scheduler failure");
            }
        },
        prismaClient: {
            $disconnect: async () => calls.push(["disconnect"])
        }
    });

    await once(lifecycle.server, "listening");
    processTarget.emit("SIGTERM");
    await assert.rejects(lifecycle.shutdown("SIGTERM"), /private scheduler failure/);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(processTarget.exitCode, 1);
    assert.equal(lifecycle.server.listening, false);
    assert.deepEqual(calls[0], ["disconnect"]);
    assert.deepEqual(calls[1], ["Graceful shutdown failed:", "Error"]);
});
