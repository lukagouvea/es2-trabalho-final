#!/usr/bin/env bash
# Disposable PostgreSQL engine verification; no remote connection or user DB access.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="campus-sql-test-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$container" --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=isolated-tests postgres:17-alpine >/dev/null
for attempt in {1..60}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 0.25
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/db/bootstrap.sql
for file in supabase/migrations/*.sql; do
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$file"
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/seed.sql
CAMPUS_DB_CONTAINER="$container" bash tests/db/run.sh
