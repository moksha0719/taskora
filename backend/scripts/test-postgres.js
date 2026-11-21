"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const BACKEND_DIR = path.resolve(__dirname, "..");
const COMPOSE_FILE = path.join(BACKEND_DIR, "docker-compose.test.yml");
const PROJECT_NAME = "taskora-postgres-test";
const CONFIG_DIR = path.join(os.homedir(), ".taskora-test");
const CONFIG_FILE = path.join(CONFIG_DIR, "postgres-compose.env");
const DISABLED_DOTENV_PATH = path.join(
    os.tmpdir(),
    `taskora-test-no-dotenv-${crypto.randomUUID()}.env`
);
const INTEGRATION_TESTS = [
    "test/integration/postgresPersistence.test.js",
    "test/integration/task3Task4Persistence.test.js",
    "test/integration/flashcardReview.test.js"
];

function randomPassword() {
    return crypto.randomBytes(36).toString("base64url");
}

function checkPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.listen(port, "127.0.0.1", () => {
            server.close(() => resolve(true));
        });
    });
}

async function findAvailablePort() {
    for (let port = 55433; port <= 55532; port += 1) {
        if (await checkPortAvailable(port)) return port;
    }
    throw new Error("No available loopback port found in the dedicated test port range 55433-55532");
}

function parseConfig(text) {
    const config = {};
    for (const line of text.split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator <= 0) throw new Error("The generated test database configuration is malformed");
        config[line.slice(0, separator)] = line.slice(separator + 1);
    }
    return config;
}

function validateConfig(config) {
    const expected = {
        TASKORA_TEST_ADMIN_DB: "postgres",
        TASKORA_TEST_ADMIN_USER: "taskora_test_admin",
        TASKORA_TEST_DB_NAME: "taskora_test_core",
        TASKORA_TEST_DB_USER: "taskora_test_user"
    };
    for (const [key, value] of Object.entries(expected)) {
        if (config[key] !== value) {
            throw new Error(`The generated test database configuration has an invalid ${key}`);
        }
    }
    if (!/^[A-Za-z0-9_-]{40,}$/.test(config.TASKORA_TEST_ADMIN_PASSWORD || "")) {
        throw new Error("The generated test database admin credential is invalid");
    }
    if (!/^[A-Za-z0-9_-]{40,}$/.test(config.TASKORA_TEST_DB_PASSWORD || "")) {
        throw new Error("The generated test database credential is invalid");
    }
    const port = Number(config.TASKORA_TEST_DB_PORT);
    if (!Number.isInteger(port) || port < 55433 || port > 55532) {
        throw new Error("The generated test database port is invalid");
    }
}

async function loadOrCreateConfig() {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    if (fs.existsSync(CONFIG_FILE)) {
        const existing = parseConfig(fs.readFileSync(CONFIG_FILE, "utf8"));
        validateConfig(existing);
        return existing;
    }

    const config = {
        TASKORA_TEST_ADMIN_DB: "postgres",
        TASKORA_TEST_ADMIN_USER: "taskora_test_admin",
        TASKORA_TEST_ADMIN_PASSWORD: randomPassword(),
        TASKORA_TEST_DB_NAME: "taskora_test_core",
        TASKORA_TEST_DB_USER: "taskora_test_user",
        TASKORA_TEST_DB_PASSWORD: randomPassword(),
        TASKORA_TEST_DB_PORT: String(await findAvailablePort())
    };
    const contents = `${Object.entries(config).map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
    fs.writeFileSync(CONFIG_FILE, contents, { flag: "wx", mode: 0o600 });
    validateConfig(config);
    return config;
}

function buildTestUrl(config) {
    const user = encodeURIComponent(config.TASKORA_TEST_DB_USER);
    const password = encodeURIComponent(config.TASKORA_TEST_DB_PASSWORD);
    return `postgresql://${user}:${password}@127.0.0.1:${config.TASKORA_TEST_DB_PORT}/${config.TASKORA_TEST_DB_NAME}?schema=public`;
}

function baseEnvironment(config) {
    const testUrl = buildTestUrl(config);
    return {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testUrl,
        TASKORA_TEST_DATABASE_URL: testUrl,
        EMAIL_PROVIDER: "mock",
        DOTENV_CONFIG_PATH: DISABLED_DOTENV_PATH
    };
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: BACKEND_DIR,
        env: options.env || process.env,
        encoding: "utf8",
        shell: false,
        windowsHide: true
    });
    if (result.stdout && !options.silent) process.stdout.write(result.stdout);
    if (result.stderr && !options.silent) process.stderr.write(result.stderr);
    if (result.error) {
        if (!options.silent) console.error(result.error.message);
        return { status: 1, output: "" };
    }
    return {
        status: result.status === null ? 1 : result.status,
        output: `${result.stdout || ""}${result.stderr || ""}`
    };
}

function composeArgs(config, args) {
    return [
        "compose",
        "--project-name", PROJECT_NAME,
        "--env-file", CONFIG_FILE,
        "--file", COMPOSE_FILE,
        ...args
    ];
}

function runCompose(config, args, options = {}) {
    return run("docker", composeArgs(config, args), options);
}

function verifyLoopbackBinding(config) {
    const result = runCompose(config, ["port", "postgres-test", "5432"], {
        silent: true
    });
    const expected = `127.0.0.1:${config.TASKORA_TEST_DB_PORT}`;
    if (result.status !== 0 || result.output.trim() !== expected) {
        throw new Error("The test PostgreSQL port is not bound exclusively to the expected loopback address");
    }
}

function requireSuccess(result, description) {
    if (result.status !== 0) {
        throw new Error(`${description} failed with exit code ${result.status}`);
    }
}

async function waitForService(config) {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        const result = runCompose(config, [
            "exec", "--no-TTY", "postgres-test",
            "pg_isready",
            "-U", config.TASKORA_TEST_ADMIN_USER,
            "-d", config.TASKORA_TEST_ADMIN_DB
        ], { silent: true });
        if (result.status === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const logs = runCompose(config, ["logs", "--no-color", "postgres-test"]);
    throw new Error(`PostgreSQL did not become ready within 90 seconds (exit ${logs.status})`);
}

function verifyDatabase(config, assertNoTestUsers = false) {
    requireSuccess(
        run(process.execPath, [
            "scripts/verify-test-database.js",
            ...(assertNoTestUsers ? ["--assert-no-test-users"] : [])
        ], {
            env: baseEnvironment(config)
        }),
        "Dedicated PostgreSQL test database verification"
    );
}

function runNpm(script, config) {
    const env = baseEnvironment(config);
    if (process.platform === "win32") {
        return run(
            process.env.ComSpec || "cmd.exe",
            ["/d", "/s", "/c", `npm.cmd run ${script}`],
            { env }
        );
    }
    return run("npm", ["run", script], { env });
}

async function start(config) {
    requireSuccess(runCompose(config, ["up", "--detach"]), "Dedicated PostgreSQL Compose startup");
    await waitForService(config);
    requireSuccess(
        runCompose(config, [
            "exec", "--no-TTY", "postgres-test",
            "/bin/sh",
            "/docker-entrypoint-initdb.d/10-create-taskora-test-database.sh"
        ]),
        "Dedicated test role and database provisioning"
    );
    verifyLoopbackBinding(config);
    verifyDatabase(config);
    console.log("The isolated test service is ready; its volume is separate from the development Compose volume.");
}

function requireReady(config) {
    const result = runCompose(config, ["ps", "--status", "running", "--quiet", "postgres-test"], {
        silent: true
    });
    if (result.status !== 0 || !result.output.trim()) {
        throw new Error("The dedicated test PostgreSQL service is not running. Run npm run db:test:up first.");
    }
    verifyLoopbackBinding(config);
    verifyDatabase(config);
}

function runIntegrationTests(config, includeUnitTests) {
    requireReady(config);
    requireSuccess(runNpm("db:status", config), "Prisma migration status check");
    const testArgs = ["--test", "--test-concurrency=1"];
    if (includeUnitTests) {
        testArgs.push("test/**/*.test.js");
    } else {
        testArgs.push(...INTEGRATION_TESTS);
    }
    requireSuccess(
        run(process.execPath, testArgs, { env: baseEnvironment(config) }),
        includeUnitTests ? "Complete backend test suite" : "PostgreSQL integration tests"
    );
    verifyDatabase(config, true);
}

async function main() {
    const action = process.argv[2] || "help";
    if (action === "help") {
        console.log(
            "Actions: up, verify, migrate, status, diff, generate, validate, integration, all, down, unit"
        );
        return;
    }
    if (action === "unit") {
        const env = { ...process.env };
        delete env.DATABASE_URL;
        delete env.TASKORA_TEST_DATABASE_URL;
        delete env.TEST_DATABASE_URL;
        env.NODE_ENV = "test";
        env.EMAIL_PROVIDER = "mock";
        env.DOTENV_CONFIG_PATH = DISABLED_DOTENV_PATH;
        requireSuccess(
            run(process.execPath, ["--test", "--test-concurrency=1", "test/**/*.test.js"], { env }),
            "Backend unit/API test suite"
        );
        return;
    }

    const config = await loadOrCreateConfig();
    switch (action) {
        case "up":
            await start(config);
            return;
        case "verify":
            requireReady(config);
            return;
        case "migrate":
            requireReady(config);
            requireSuccess(runNpm("db:deploy", config), "Prisma migrations on test database");
            requireSuccess(runNpm("db:status", config), "Prisma migration status check");
            return;
        case "status":
            requireReady(config);
            requireSuccess(runNpm("db:status", config), "Prisma migration status check");
            return;
        case "diff":
            requireReady(config);
            requireSuccess(runNpm("db:test:diff-schema", config), "Prisma schema comparison");
            return;
        case "generate":
            requireSuccess(runNpm("db:generate", config), "Prisma Client generation");
            return;
        case "validate":
            requireSuccess(runNpm("db:validate", config), "Prisma schema validation");
            return;
        case "integration":
            runIntegrationTests(config, false);
            return;
        case "all":
            runIntegrationTests(config, true);
            return;
        case "down":
            requireSuccess(runCompose(config, ["down"]), "Dedicated PostgreSQL test service shutdown");
            console.log("The isolated test container is stopped; its test-only volume was preserved.");
            return;
        default:
            throw new Error(`Unknown test database action: ${action}`);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
