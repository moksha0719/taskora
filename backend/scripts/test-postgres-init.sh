#!/bin/sh
set -eu

role_exists=$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --set=test_user="$TASKORA_TEST_DB_USER" <<'SQL'
SELECT 1 FROM pg_roles WHERE rolname = :'test_user';
SQL
)
if [ "$role_exists" != "1" ]; then
  echo "Creating the restricted Taskora test database role."
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=test_user="$TASKORA_TEST_DB_USER" \
    --set=test_password="$TASKORA_TEST_DB_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
  :'test_user',
  :'test_password'
) \gexec
SQL
fi

database_exists=$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --set=test_database="$TASKORA_TEST_DB_NAME" <<'SQL'
SELECT 1 FROM pg_database WHERE datname = :'test_database';
SQL
)
if [ "$database_exists" != "1" ]; then
  echo "Creating the dedicated Taskora test database."
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=test_database="$TASKORA_TEST_DB_NAME" \
    --set=test_user="$TASKORA_TEST_DB_USER" <<'SQL'
SELECT format(
  'CREATE DATABASE %I OWNER %I',
  :'test_database',
  :'test_user'
) \gexec
SQL
fi
