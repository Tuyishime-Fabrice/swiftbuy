#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="${SHOP_MUMU_TEST_DB:-shop_mumu_test}"
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
