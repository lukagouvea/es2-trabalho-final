#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
container="${CAMPUS_DB_CONTAINER:-supabase_db_campus-em-dia}"
for file in tests/db/behavior.sql tests/db/storage.sql tests/db/administration.sql; do
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$file"
done
python3 tests/db/concurrency.py "$container"
