#!/usr/bin/env bash
# Create the finance database, its login role and all tables.
#
# Usage (from the repo root):
#   cp server/.env.example server/.env     # then fill in server/.env
#   PGADMIN_USER=postgres server/db/setup.sh
#
# Needs psql. Prompts for the superuser's password unless PGPASSWORD is set for it.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
env_file="${ENV_FILE:-$here/../.env}"
if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Copy server/.env.example to server/.env and fill it in." >&2
  exit 1
fi
set -a; source "$env_file"; set +a

: "${DB_HOST:?DB_HOST missing in .env}" "${DB_PORT:?}" "${DB_NAME:?}" "${DB_USER:?}"
: "${DB_PASSWORD:?DB_PASSWORD missing in .env}"
admin="${PGADMIN_USER:-postgres}"
sslmode="${DB_SSLMODE:-prefer}"

echo "1/2 Creating role '$DB_USER' and database '$DB_NAME' on $DB_HOST:$DB_PORT as '$admin'..."
psql "host=$DB_HOST port=$DB_PORT user=$admin dbname=${PGADMIN_DB:-postgres} sslmode=$sslmode" \
  -v app_user="$DB_USER" -v app_password="$DB_PASSWORD" -v app_db="$DB_NAME" \
  -f "$here/setup.sql"

echo "2/2 Creating tables as '$DB_USER'..."
for file in "$here"/migrations/*.sql; do
  version="$(basename "$file" .sql)"
  echo "  $version"
  PGPASSWORD="$DB_PASSWORD" psql -q \
    "host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME sslmode=$sslmode" \
    -v ON_ERROR_STOP=1 -f "$file" \
    -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING"
done

echo "Done. Tables in $DB_NAME:"
PGPASSWORD="$DB_PASSWORD" psql \
  "host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME sslmode=$sslmode" -c '\dt'
