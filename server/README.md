# Server database (PostgreSQL)

The app is local-first today: data lives in SQLite on the phone, or in browser storage on the
web build. This folder holds the PostgreSQL side for when data moves to a server.

The phone and web apps must never connect to PostgreSQL directly or carry its password. A small
API server sits in between, reads `server/.env`, and is the only thing that talks to the
database.

## Files

| File                         | What it is                                                                 | Committed?         |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------ |
| `server/.env`                | Real connection settings and password                                      | **No**, gitignored |
| `server/.env.example`        | Template for `server/.env`                                                 | Yes                |
| `server/db/setup.sql`        | Creates the login role and the `finance` database (run as superuser)       | Yes                |
| `server/db/migrations/*.sql` | Tables, indexes and triggers, applied in order                             | Yes                |
| `server/db/setup.sh`         | Runs `setup.sql`, then every migration, with the values from `server/.env` | Yes                |
| `server/src/`                | The API server (Node.js, no framework: `pg` and `zod` only)                | Yes                |

## Set up the database

From a machine that can reach the database host, with `psql` installed:

```bash
cp server/.env.example server/.env   # then put the real password in it
PGADMIN_USER=postgres server/db/setup.sh
```

It asks for the superuser's password once, creates the `finance_app` role and the `finance`
database, then applies every migration. It is safe to run again; re-running resets the role's
password to the one in `server/.env`.

## Run the API server

On a computer on the same network as the database (Node.js 20.6 or newer):

```bash
cd server
npm install
npm start          # reads server/.env, applies any new migrations, listens on port 8787
```

Then in the app: **Me → Server sync**, enter the server address (for example
`192.168.1.5:8787`, the address of the computer running `npm start`), and **Create account**.
Only the first account can sign up (`SIGNUP=first`); after that, sign in with it on other
phones.

- **Upload this phone's data** replaces your data on the server with what's on the phone.
- **Download to this phone** replaces everything on the phone with the server's copy.

### Endpoints

| Method and path         | What it does                                                                     |
| ----------------------- | -------------------------------------------------------------------------------- |
| `GET /health`           | `{ ok: true }`                                                                   |
| `POST /api/auth/signup` | `{ email, password }` → `{ token, user }`                                        |
| `POST /api/auth/login`  | `{ email, password }` → `{ token, user }`; 10 wrong tries per 15 min per address |
| `POST /api/auth/logout` | Ends this token's session                                                        |
| `GET /api/me`           | The account and when it last uploaded                                            |
| `GET /api/sync`         | Everything for this account, in the app's backup format                          |
| `PUT /api/sync`         | Replaces everything for this account with the body (same format)                 |

Passwords are hashed with scrypt; tokens are random and only their SHA-256 is stored.

### Reaching the server from a phone

- **Expo Go / development builds** can call `http://192.168.1.5:8787` directly.
- **Release Android builds** block plain `http://` by default, and the **web build on GitHub
  Pages** (an `https://` page) can't call an `http://` server. For those, put the API behind
  HTTPS (for example a reverse proxy with a certificate) and use that `https://` address.

### Tests

```bash
cd server
npm test                                            # unit tests
TEST_DATABASE_URL=postgres://user:pass@host/finance_test npm test   # plus API tests
```

The API tests wipe the database they're pointed at, so never point them at `finance`.

## Schema notes

- Mirrors `src/db/schema.ts`, plus a `users` table and a `user_id` on every user-owned table so
  the API can scope each query to the signed-in user.
- Money is `numeric(18,2)`, rates are `numeric` percentages, dates are `date`, timestamps are
  `timestamptz`. Enum columns have `CHECK` constraints matching `src/domain/*.ts`.
- Cards store `card_last4` only. Never store a full card number, CVV or PIN.
- When `src/db/schema.ts` changes, add the same change as a new file in `server/db/migrations/`.
  The server applies new files when it starts.

## Securing the host

The database listens on a public IP. Before real data goes in:

- In `pg_hba.conf`, allow `finance_app` only from the API server's address, with
  `scram-sha-256`, and block other remote logins.
- Turn on TLS (`ssl = on`) and set `DB_SSLMODE=require` in `server/.env`.
- Firewall port 55432 to the API server's address if you can.
