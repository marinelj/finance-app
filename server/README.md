# Server database (PostgreSQL)

The app is local-first today: data lives in SQLite on the phone, or in browser storage on the
web build. This folder holds the PostgreSQL side for when data moves to a server.

The phone and web apps must never connect to PostgreSQL directly or carry its password. A small
API server sits in between, reads `server/.env`, and is the only thing that talks to the
database.

## Files

| File | What it is | Committed? |
| --- | --- | --- |
| `server/.env` | Real connection settings and password | **No**, gitignored |
| `server/.env.example` | Template for `server/.env` | Yes |
| `server/db/setup.sql` | Creates the login role and the `finance` database (run as superuser) | Yes |
| `server/db/schema.sql` | Creates every table, index and trigger (run as the app role) | Yes |
| `server/db/setup.sh` | Runs both of the above with the values from `server/.env` | Yes |

## Set up the database

From a machine that can reach the database host, with `psql` installed:

```bash
cp server/.env.example server/.env   # then put the real password in it
PGADMIN_USER=postgres server/db/setup.sh
```

It asks for the superuser's password once, creates the `finance_app` role and the `finance`
database, then creates the tables. It is safe to run again; re-running resets the role's
password to the one in `server/.env`.

## Schema notes

- Mirrors `src/db/schema.ts`, plus a `users` table and a `user_id` on every user-owned table so
  the API can scope each query to the signed-in user.
- Money is `numeric(18,2)`, rates are `numeric` percentages, dates are `date`, timestamps are
  `timestamptz`. Enum columns have `CHECK` constraints matching `src/domain/*.ts`.
- Cards store `card_last4` only. Never store a full card number, CVV or PIN.
- When `src/db/schema.ts` changes, add the same change here as a new migration.

## Securing the host

The database listens on a public IP. Before real data goes in:

- In `pg_hba.conf`, allow `finance_app` only from the API server's address, with
  `scram-sha-256`, and block other remote logins.
- Turn on TLS (`ssl = on`) and set `DB_SSLMODE=require` in `server/.env`.
- Firewall port 55432 to the API server's address if you can.
