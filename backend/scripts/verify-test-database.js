"use strict";

const assert = require("node:assert/strict");
const { Client } = require("pg");

async function main() {
    const connectionString = process.env.TASKORA_TEST_DATABASE_URL;
    assert.ok(connectionString, "TASKORA_TEST_DATABASE_URL is required");

    const url = new URL(connectionString);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    assert.ok(
        ["postgres:", "postgresql:"].includes(url.protocol) &&
        url.hostname === "127.0.0.1" &&
        Number(url.port) >= 55433 &&
        Number(url.port) <= 55532 &&
        databaseName === "taskora_test_core" &&
        decodeURIComponent(url.username) === "taskora_test_user",
        "Refusing to connect: test database URL does not match the dedicated local test target"
    );

    const client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000
    });
    try {
        await client.connect();
        const result = await client.query(`
            SELECT
                current_database() AS database_name,
                current_user AS role_name,
                current_setting('server_version') AS server_version,
                (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
                (SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user) AS can_create_database,
                (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS can_create_roles,
                (SELECT rolinherit FROM pg_roles WHERE rolname = current_user) AS inherits_roles,
                (
                    SELECT count(*)::integer
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ) AS public_table_count,
                (
                    SELECT datdba = (SELECT oid FROM pg_roles WHERE rolname = current_user)
                    FROM pg_database
                    WHERE datname = current_database()
                ) AS owns_test_database
        `);
        const database = result.rows[0];
        assert.equal(database.database_name, "taskora_test_core");
        assert.equal(database.role_name, "taskora_test_user");
        assert.equal(database.is_superuser, false);
        assert.equal(database.can_create_database, false);
        assert.equal(database.can_create_roles, false);
        assert.equal(database.inherits_roles, false);
        assert.equal(database.owns_test_database, true);
        assert.equal(database.server_version.split(".")[0], "16");
        console.log(
            `Connected to PostgreSQL ${database.server_version}; ` +
            `database=${database.database_name}; role=${database.role_name}; ` +
            `superuser=${database.is_superuser}; owner=${database.owns_test_database}`
        );
        console.log(`Public tables: ${database.public_table_count}`);
        if (process.argv.includes("--assert-no-test-users")) {
            const cleanup = await client.query(`
                SELECT count(*)::integer AS remaining
                FROM "User"
                WHERE email LIKE '%@taskora.test'
            `);
            assert.equal(cleanup.rows[0].remaining, 0, "Integration test user records were not cleaned up");
            console.log("Integration test user records remaining: 0");
        }
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
