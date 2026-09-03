#!/usr/bin/env bash
# Applies the migrations to a throwaway PostgreSQL database and runs the
# security/commerce suite against them.
#
#   ./supabase/tests/run.sh                # uses a local cluster on $PGPORT
#   PGHOST=/tmp PGPORT=55432 ./supabase/tests/run.sh
#
# Requires psql 15+. The local shim stands in for Supabase's auth and storage
# schemas so the suite needs no cloud project.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="${SWIFTBUY_TEST_DB:-swiftbuy_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q --set=QUIET=1)

export PGUSER="${PGUSER:-postgres}"
export PGDATABASE=postgres

echo "▸ recreating database $DB"
"${PSQL[@]}" -c "drop database if exists $DB;" >/dev/null
"${PSQL[@]}" -c "create database $DB;" >/dev/null

export PGDATABASE="$DB"
export PGOPTIONS='--client-min-messages=warning'

echo "▸ applying local Supabase shim"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_local_shim.sql" >/dev/null

for m in "$ROOT"/supabase/migrations/*.sql; do
  echo "▸ applying $(basename "$m")"
  "${PSQL[@]}" -f "$m" >/dev/null
done

echo "▸ running security and commerce suite"
psql -v ON_ERROR_STOP=1 -X -q -f "$ROOT/supabase/tests/01_security_and_commerce.sql"
