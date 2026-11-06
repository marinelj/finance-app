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

Once signed in, the server holds your data and each device keeps a working copy:

- Every change saves to the server automatically, a moment after you make it.
- When the app opens, comes back to the foreground, or a minute passes, it checks the server
  and loads changes saved by your other devices.
- Offline, the app keeps working and saves when the connection is back.
- If two devices changed data before syncing, sync pauses and **Me → Server sync** asks which
  copy to keep.

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

### Using it from the github.io site

The web app stays on GitHub Pages (`https://marinelj.github.io/finance-app/`). Only the
personal data goes to the server on your Mac Studio. Because the page is `https://`, the
browser blocks it from calling a plain `http://192.168.x.x` address, so the server needs an
`https://` address of its own. The app says so if you enter an `http://` address on the site.

The simplest way is **Tailscale**, which gives the Mac Studio a private `https://` address that
only your own devices can reach, at home or away:

1. Install Tailscale on the Mac Studio and on each phone or computer you'll use, and sign in
   to the same account on all of them.
2. In the Tailscale admin console, under **DNS**, turn on **MagicDNS** and **HTTPS
   Certificates**.
3. On the Mac Studio, start the API (`npm start` in `server/`), then run:

   ```bash
   tailscale serve --bg 8787
   ```

   It prints the address, like `https://mac-studio.your-tailnet.ts.net`.

4. In `server/.env`, keep `CORS_ORIGINS=https://marinelj.github.io` (scheme and host only, no
   `/finance-app` path). To accept connections only through Tailscale, also set
   `API_HOST=127.0.0.1`.
5. On the github.io site, open **Me → Server sync** and enter that `https://…ts.net` address.

The same `https://` address also works in the phone apps, including release Android builds,
which block plain `http://` too. Expo Go and development builds can keep using
`http://192.168.x.x:8787` on your Wi-Fi.

### Codex gateway on the same API port

An independent [Codex HTTP Gateway](https://github.com/marinelj/codex-http-gateway)
can share this server's published port under `/codex`. Start the gateway with
`GATEWAY_HOST=127.0.0.1 GATEWAY_PORT=18080 GATEWAY_ROOT_PATH=/codex`, then add
`CODEX_UPSTREAM=http://127.0.0.1:18080` to `server/.env` and restart this server.
The upstream must be a loopback HTTP origin; no external proxy targets are accepted.

Clients call `/codex/v1/runs` and `/codex/v1/threads/{thread_id}` using the gateway's
own bearer token. Finance tokens do not grant Codex access. The proxy forwards client
authentication and idempotency headers, streams responses, and preserves gateway
status codes. Existing `/api/*` and `/health` endpoints keep their current behavior.
If the gateway is down, only `/codex/*` requests return `502`.

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

## Email bill ingestion

Set `INGEST_TOKEN` in `server/.env` to a secret generated from at least 32 random bytes. Without
it, the ingest endpoints return 404. It authorizes only `GET /api/ingest/cards` and
`POST /api/ingest/statements`; it cannot sign in, read `/api/me`, or use `/api/sync`.
The two endpoints share a limit of 60 requests per hour, including rejected requests.

The cards response is an explicit metadata allowlist without balances. Statement batches accept
at most 1,000 parsed entries; never send raw email bodies or full card numbers. Invalid entries
are reported individually. Matching uses an explicit product ID scoped to the first user, then
bill email plus last four digits, then bill email plus issuer only when exactly one product
matches. Product currency must match the statement. Ambiguity returns `unmatched`.

A source message ID identifies one bill per user. Replays are no-ops. Newer bills are ordered by
due date, statement date, received time, then source message ID; delayed older mail cannot
replace the current statement figures. Only `statement_balance` and `minimum_payment` change;
`balance` and billing-cycle days remain as entered. Changes share the sync lock and bump the
revision once per changed batch. Logs contain status counts only.

Email bill history survives older clients' snapshot uploads. Missing bill-delivery fields retain
their server values; deleting a product still cascades its bill history. The backup payload
format stays at version 3 because the added nullable fields and optional table are compatible.
