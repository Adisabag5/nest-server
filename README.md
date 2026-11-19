# sequencer-server

The backend for **Pulse** ([visual-sequencer](https://github.com/Adisabag5/visual-sequencer)),
an 8-track × 16-step audiovisual drum machine. This server owns identity, profiles and
saved work; the frontend owns the pattern format.

NestJS 11 · TypeScript · TypeORM + MySQL · JWT with rotating refresh tokens.

---

## Quick start

**Needs** Node 24 (see `.nvmrc`), pnpm, and a MySQL you can reach.

```bash
nvm use                       # Node 24
pnpm install
cp .env.example .env          # then fill it in — see below
pnpm start:dev                # http://localhost:3000/api
```

Check it came up:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","uptimeSeconds":3,"database":"up"}
```

### The `.env`

`.env.example` is the schema; every key is validated at boot, so a missing or malformed
one stops the server rather than surfacing later as a confusing runtime error.

The two worth care:

- **`NODE_ENV`** — `development` turns on TypeORM's `synchronize`; `production` turns it
  off and runs migrations instead. It also decides the refresh cookie's `Secure` flag.
- **`JWT_SECRET` and `JWT_REFRESH_SECRET`** must differ. A leaked access secret must not be
  able to mint refresh tokens. Generate with `openssl rand -base64 48`.

## Commands

| | |
|---|---|
| `pnpm start:dev` | watch mode |
| `pnpm test` | unit tests (Jest) |
| `pnpm test:e2e` | end-to-end tests |
| `pnpm lint:check` / `pnpm typecheck` | what CI runs |
| `pnpm build` / `pnpm start:prod` | compile / run compiled |
| `pnpm migration:run` / `:show` / `:revert` | schema |
| `pnpm set-role <email> ADMIN` | promote an account |

Neither test suite needs a database: both use in-memory fakes, so `pnpm test && pnpm
test:e2e` works on a fresh clone with no setup.

## The API

Everything is mounted under **`/api`**. Every route needs a bearer access token, with
three exceptions: `GET /api` and `GET /api/health` are open, `signup` and `signin` are
open, and `refresh` and `signout` are authenticated by the refresh **cookie** rather than
a token.

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/{signup,signin,refresh,signout}` |
| Profile | `GET`/`PATCH /api/profiles/me`, `GET /api/profiles/:username` |
| Collections | CRUD under `/api/collections` |
| Beats | CRUD under `/api/beats`, `?collectionId=` filter |
| Accounts | CRUD under `/api/user` — **ADMIN only** |
| Health | `GET /api/health` |

List endpoints return `{ items, meta }`, never a bare array, with `?page=` and `?limit=`
(default 20, max 100).

Errors all have one shape (from the global exception filter):

```json
{ "statusCode": 409, "message": "...", "error": "Conflict",
  "path": "/api/auth/signup", "timestamp": "2026-11-19T18:58:27.410Z" }
```

## Things worth knowing before changing anything

**Sessions use two tokens.** A short-lived access token (bearer header, stateless, cannot
be revoked) and a refresh token that lives in an httpOnly cookie scoped to `/api/auth` and
has a row in `refresh_tokens` — which is what makes revocation, and therefore a real
sign-out, possible. Every refresh rotates the token; replaying a rotated one is read as
theft and revokes every session that user has.

**`synchronize` is development-only.** It rewrites the schema to match the entities on
every boot, which is convenient on a throwaway database and data loss on a real one.
Production runs migrations at boot instead.

**Rate limiting counts by IP**, and behind a reverse proxy that is the proxy's IP unless
`TRUST_PROXY` is set. Unset behind nginx, every visitor shares one bucket and a few
sign-in attempts lock out everyone.

**`data` on a beat is opaque.** It holds the frontend's versioned `SavedState` blob
verbatim; the server validates only that `version` is a positive integer and that the
payload is under 256 KB. The frontend owns that schema and its migrations.

## Deploying

See **[`DEPLOY.md`](./DEPLOY.md)** — a single-origin Hostinger VPS, where this server
serves both the API and the built frontend.

## Working on it

**[`CLAUDE.md`](./CLAUDE.md)** is the file to read first: conventions, the full route
table, the data model, and the reasoning behind decisions that look odd until you know
why. It is the index — the rest of the docs hang off it.

CI runs lint, typecheck, both suites and a build on every pull request.
