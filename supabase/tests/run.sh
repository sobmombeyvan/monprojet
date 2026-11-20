#!/usr/bin/env bash
# Runs migrations + seed + acceptance tests against a throwaway Postgres database.
# Usage: PGHOST=/tmp/pg PGPORT=5433 PGUSER=postgres bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-globentia_test}
PSQL="psql -v ON_ERROR_STOP=1 -q -X"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
# roles are cluster-wide: create them only once
$PSQL -d postgres -tc "select 1 from pg_roles where rolname='anon'" | grep -q 1 && \
  sed '/^create role/d;/^grant anon, authenticated, service_role to postgres;/d' tests/00_supabase_shim.sql > /tmp/shim.sql || cp tests/00_supabase_shim.sql /tmp/shim.sql
for f in /tmp/shim.sql migrations/*.sql seed.sql; do
  $PSQL -d $DB -f "$f" 2>&1 | grep -v NOTICE || true
done
$PSQL -t -d $DB -f tests/10_booking_payment_rls.sql | grep -v "^\s*$"
