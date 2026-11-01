-- Finance app: create the login role and the database.
--
-- Run ONCE as a PostgreSQL superuser (e.g. "postgres") with psql, passing the values from
-- server/.env as psql variables. server/db/setup.sh does this for you:
--
--   psql "host=$PGHOST port=$PGPORT user=postgres dbname=postgres" \
--        -v app_user="$DB_USER" -v app_password="$DB_PASSWORD" -v app_db="$DB_NAME" \
--        -f server/db/setup.sql
--
-- No password is written in this file; it comes from the -v variable.

\set ON_ERROR_STOP on

-- Login role used by the API server. Not a superuser, cannot create roles or databases.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
              :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec

-- Re-running resets the password to the one in server/.env.
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password') \gexec

-- The database ("instance") for the app, owned by the app role.
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0',
              :'app_db', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_db') \gexec

-- Only the app role (and superusers) may connect.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'app_db') \gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', :'app_db', :'app_user') \gexec

-- pgcrypto needs a superuser on older servers, so install it here.
\connect :app_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
