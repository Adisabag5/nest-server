# CLAUDE.md — nest-server

Learning project: a small NestJS REST server. Owner: Adi. Goal is learning Nest
fundamentals (modules / controllers / services / DI / DTOs / TypeORM), not production.

It is the backend for **Pulse** (`~/DEV/visual-sequencer`), an Angular + Tone.js step
sequencer for making beats. The server owns identity, profiles, and saved work; the
frontend owns the pattern format.

**How to use this file:** it is the index. Read it first, then open only the 1–3 files
you need from the map below. Do not scan `src/` or run `find`. Never read
`node_modules/`, `dist/`, `pnpm-lock.yaml`.

## Stack

Node 24 LTS (`.nvmrc`) · TypeScript 5.7 (ESM `nodenext`, `strictNullChecks` on, `noImplicitAny` off)
NestJS 11 · TypeORM + MySQL (`mysql2`) · `@nestjs/config` · `bcrypt` · `class-transformer` +
`class-validator` · `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` · Jest + Supertest
· pnpm 10.33 (pinned via `packageManager`)

## Commands (run from repo root)

| Task | Command |
|---|---|
| dev (watch) | `pnpm start:dev` |
| build / prod | `pnpm build` / `pnpm start:prod` |
| unit tests | `pnpm test` (Jest, `rootDir: src`, `*.spec.ts`) |
| e2e | `pnpm test:e2e` (`test/jest-e2e.json`) |
| lint / format | `pnpm lint` / `pnpm format` (prettier: single quotes, trailing commas) |
| lint without fixing | `pnpm lint:check` — what CI runs |
| typecheck everything | `pnpm typecheck` |
| scaffold | `nest g resource <name>` |
| promote/demote a user | `pnpm set-role <email> <ADMIN\|USER>` |
| run pending migrations | `pnpm migration:run` |
| list migration state | `pnpm migration:show` |
| undo the last migration | `pnpm migration:revert` |
| write a new migration | `pnpm typeorm migration:generate src/migrations/<Name>` |
| typecheck (equivalently) | `npx tsc --noEmit` (`pnpm build` skips `*.spec.ts`) |

## File map

```
src/
  main.ts                  bootstrap; /api prefix, ValidationPipe, serializer, static client, PORT ?? 3000
  config/api-prefix.ts     API_PREFIX — one source for the prefix and the cookie Path
  health/                  GET /api/health: public liveness + a real DB round trip
  app.module.ts            root: ConfigModule(global, validated) + TypeOrmModule.forRootAsync + Profiles/User/AuthModule
  app.controller.ts        GET / -> "Hello World!" (@Public)
  app.service.ts
  config/env.validation.ts EnvironmentVariables class + validateEnv(); fails boot on a bad .env
  config/data-source.ts    DataSource for the TypeORM CLI only (the app uses forRootAsync)
  config/throttle.ts       rate limits: the default budget and the strict auth one
  migrations/              versioned schema SQL; production runs these on boot
  common/pagination.ts     paginate() + buildMeta(); the Paginated<T> shape
  common/filters/all-exceptions.filter.ts  one error shape; hides non-HTTP errors, logs 5xx
  common/dto/pagination-query.dto.ts  ?page= &limit= (default 20, max 100)
  scripts/set-role.ts      CLI: promote/demote a user out of band (the first admin)
  auth/                    AUTH module — JWT issue + verify
    auth.controller.ts     POST /auth/signup, /auth/signin, /auth/refresh, /auth/signout
    auth.service.ts        bcrypt.compare + token issuing; rotation & reuse detection
    cookies.ts             REFRESH_COOKIE name + httpOnly/SameSite/Path options
    entities/refresh-token.ts  one row per session; sha256 hash, expiry, revoked_at/reason
    auth.module.ts         imports UserModule + JwtModule.registerAsync; registers APP_GUARD
    dto/sign-in.dto.ts     email + non-empty password (no policy rules — see below)
    strategies/jwt.strategy.ts  passport-jwt 'jwt'; Bearer header, access secret
    strategies/jwt-refresh.strategy.ts  'jwt-refresh'; reads the cookie, refresh secret
    guards/jwt-auth.guard.ts    global guard; lets @Public() routes through
    guards/jwt-refresh.guard.ts protects /auth/refresh + /auth/signout via the cookie
    decorators/public.decorator.ts  @Public() -> SetMetadata(IS_PUBLIC_KEY, true)
    decorators/current-user.decorator.ts  @CurrentUser() -> request.user ({id,email,role})
    enums/roles.enum.ts    Role.ADMIN / Role.USER (used by the entity and @Roles)
  profile/                 one profile per user, created with the user
    profile.controller.ts  GET/PATCH /profiles/me, GET /profiles/:username
    profile.service.ts     username allocation + uniqueness; createForUser(manager,…)
    entities/profile.entity.ts  @Entity('profiles'); 1:1 User, unique username
  collection/              named containers for a user's beats
    collection.controller.ts  CRUD under /collections
    collection.service.ts  every method scoped by userId; 403 on someone else's row
    entities/collection.entity.ts  @Entity('collections'); unique (user_id, name)
  beat/                    a saved pattern, owned by a user; full CRUD
    beat.controller.ts     CRUD under /beats, ?collectionId= filter
    beat.service.ts        ownership checks, data.version + size validation
    entities/beat.entity.ts  @Entity('beats'); json `data` column
  user/                    DB-BACKED module (TypeORM) — the "learn persistence" module
    user.controller.ts     CRUD routes under /user
    user.service.ts        full CRUD; hashes passwords, 409 on duplicate email, 404 on missing;
                         findByEmail() returns null (login's lookup, must not 404)
    user.module.ts         TypeOrmModule.forFeature([User]); exports UserService for AuthModule
    entities/user.entity.ts   @Entity('users'); @Exclude() on passwordHash; role enum col
    dto/create-user.dto.ts, dto/update-user.dto.ts (PartialType)
test/app.e2e-spec.ts       e2e for GET / and the /profiles routes; no DB required
test/auth.e2e-spec.ts      e2e for signup/signin/guard with an in-memory fake repository
```

## Routes

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/api` | AppController.getHello | `@Public()` |
| GET | `/api/health` | HealthController.check | `@Public()`; `{status, uptimeSeconds, database}` |
| POST | `/api/auth/signup` | AuthService.signup | `@Public()`; 201 + `{access_token, user}`; 409 on duplicate |
| POST | `/api/auth/signin` | AuthService.signIn | `@Public()`; **200** (nothing created); 401 on bad credentials |
| POST | `/api/auth/refresh` | AuthService.refresh | `@Public()` + `JwtRefreshGuard`; **200**; rotates the cookie |
| POST | `/api/auth/signout` | AuthService.signOut | cookie-authenticated; revokes **this** session only |
| GET | `/api/profiles/me` | ProfileService.findByUserId | own profile |
| PATCH | `/api/profiles/me` | update | 409 if the username is taken |
| GET | `/api/profiles/:username` | findByUsername | 404 if missing |
| POST | `/api/collections` | CollectionService.create | 409 on a duplicate name for that user |
| GET | `/api/collections` | findAllForUser | only the caller's; **paginated** |
| GET/PATCH/DELETE | `/api/collections/:id` | | 404 if missing, **403** if not yours; DELETE is 204 |
| POST | `/api/beats` | BeatService.create | 400 unless `data.version` is a positive int |
| GET | `/api/beats` | findAllForUser | `?collectionId=` filters; **paginated** |
| GET/PATCH/DELETE | `/api/beats/:id` | | 404 if missing, **403** if not yours; DELETE is 204 |
| POST | `/api/user` | UserService.create | hashes password (bcrypt, 10 rounds); 409 on duplicate email |
| GET | `/api/user` | findAll | **paginated** |
| GET | `/api/user/:id` | findOne | 404 if missing |
| PATCH | `/api/user/:id` | update | 404 if missing, 409 on duplicate email; re-hashes `password` |
| DELETE | `/api/user/:id` | remove | 404 if missing |

**Rate limiting.** `ThrottlerGuard` is an `APP_GUARD`, so a new controller is limited the
moment it exists and opening a hole is an explicit `@SkipThrottle()` — the same reasoning
as `JwtAuthGuard`. Two budgets, both per client IP (`config/throttle.ts`): a generous
default (120/min) for ordinary traffic, and a strict one on `signup` and `signin`
(10/min, then blocked for 5 minutes). Over the limit is a **429**, before the credential
check runs. `refresh` deliberately keeps the default budget — it fires on every page load,
and reuse detection punishes a replayed token far more precisely than a rate limit could.
`GET /api/health` is exempt, because monitoring polls it on a fixed interval.

Counting is in memory, so each process counts alone and a restart forgets. That is the
right trade for one VPS instance; the day a second one exists, the effective limit silently
doubles.

**`TRUST_PROXY` decides who gets counted.** It is the number of reverse proxies in front of
the app — 1 behind the nginx in `DEPLOY.md`, unset when Node is exposed directly. Unset
behind a proxy, every request looks like it came from the proxy and all callers share one
bucket, so a few sign-in attempts lock out everyone. Set with no proxy, a client can forge
`X-Forwarded-For` and get a fresh bucket per request. Both fail silently, which is why it
is explicit rather than inferred from `NODE_ENV`.

**Every `/api/user/*` route is ADMIN-only** — `@Roles(Role.ADMIN)` + `RolesGuard` sit on
the controller, not on individual handlers. Pulse never calls these: it signs people in
through `/api/auth` and reads their details through `/api/profiles`. Self-service account
editing, if it is ever wanted, belongs on a `/api/user/me`-shaped route that takes the id
from the token, the way `/api/profiles/me` does — never from a path parameter.

**Everything the server answers lives under `/api`** (`setGlobalPrefix`). Pulse is served
from the same origin in production, and without the prefix the Angular route `/auth` and
the API's `/auth/*` endpoints share a path — they only miss each other today because the
page is a GET and the endpoints are POSTs. `API_PREFIX` lives in `config/api-prefix.ts`
because the refresh cookie's `Path` must track it; a cookie on the wrong path is sent on no
request at all, and that reads as a broken session rather than a broken path.

**Serving the frontend.** Set `CLIENT_DIST` to the built Angular directory and the server
serves it, falling back to `index.html` for any non-API GET so deep links reach the router.
Unset, the server is API-only — which is what dev and both test suites expect. If it points
somewhere without an `index.html`, boot fails loudly rather than 404ing every page.

`id` params are **strings** end-to-end (`User.id` is `bigint`, which TypeORM maps to string).
`passwordHash` never reaches a response: `@Exclude()` on the entity + a global
`ClassSerializerInterceptor` registered in `main.ts`. Because `@Exclude()` is class
metadata, services must return **entity instances** (`repo.create(...)` then `save(...)`),
never plain object literals — the interceptor cannot strip fields off a plain object.

## Refresh tokens & sessions

Two tokens, two secrets. The **access token** (Bearer header, short-lived) is stateless
and cannot be revoked. The **refresh token** lives in an httpOnly cookie scoped to
`/auth`, and every one has a row in `refresh_tokens` — which is what makes revocation,
and therefore a real `signout`, possible at all.

- Cookie flags: `httpOnly` always; `secure` when `NODE_ENV=production`; `SameSite=Lax`
  everywhere, because the app and the API share one origin and the cookie is never sent
  cross-site. `Path=/api/auth`, so ordinary API calls never carry it. Splitting the
  frontend onto its own domain again would mean `SameSite=None` (which requires `Secure`)
  plus that origin in `CORS_ORIGIN`.
- **Rotation**: every `/auth/refresh` revokes the presented token and issues a new one.
- **Reuse detection**: replaying a token revoked with reason `ROTATED` means two parties
  hold it, so every session for that user is revoked. A token revoked by `SIGNED_OUT` is
  just a stale client retrying — it 401s without touching other devices. That distinction
  is why `revoked_reason` exists.
- Tokens carry a `jti`: a JWT is a pure function of (payload, secret) and `iat` has
  one-second resolution, so without it two tokens minted in the same second are
  byte-identical — two devices would silently share one session row.
- Only a sha256 **hash** of the refresh token is stored, never the token.
- `signOut` revokes only the presented session; `revokeAllForUser()` exists for password
  changes and reuse detection.

**Every route is protected by default.** `AuthModule` registers `JwtAuthGuard` as an
`APP_GUARD`, so a new controller is guarded the moment it exists; opening a route is an
explicit `@Public()`. Only `GET /`, `POST /auth/signup` and `POST /auth/signin` are public
— `/user/*` and `/profiles/*` need `Authorization: Bearer <token>`.

Login rules that look wrong but aren't: `findByEmail` returns `null` instead of throwing
404, and both "unknown email" and "wrong password" return the **same** generic 401.
Distinguishable answers would make the route an account-enumeration oracle. For the same
reason `SignInDto` validates only "is an email / is non-empty", never the password policy.

All request bodies pass a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
`transform`), so an unknown property or a bad field is a `400` before the handler runs.

## Pagination

Every list endpoint (`GET /beats`, `/collections`, `/user`) returns

```json
{ "items": [...], "meta": { "total", "page", "limit", "totalPages", "hasNext", "hasPrev" } }
```

not a bare array. Query params are `?page=` (default 1) and `?limit=` (default 20, max
100); anything invalid — `page=0`, `limit=101`, a non-number, or an undeclared param — is a
400 from the global pipe, because the query is a DTO (`PaginationQueryDto`) like any body.

Two things worth knowing:

- **Offset-based, deliberately.** `page`/`limit` lets the frontend jump to any page and
  show "20 of 143". The cost is that rows shift if the underlying data changes between
  requests. Keyset (cursor) pagination avoids that and scales better, but can't jump to a
  page or report a total — the wrong trade for a user's own library of beats.
- **Ordering must be deterministic or pages leak rows.** Every paginated query ends with
  `id` as a tiebreaker (`updatedAt DESC, id DESC` for beats), because MySQL is free to
  return equal-sorting rows in any order, and then a row can appear on two pages or none.

`ClassSerializerInterceptor` still strips `@Exclude()` fields inside `items` — the entities
are nested in a plain wrapper, and class-transformer recurses into it. There is an e2e
pinning that, since it is exactly the kind of thing that breaks silently.

## Data model

`users` table (`src/user/entities/user.entity.ts`):
`id` bigint PK auto · `email` varchar(100) unique · `password_hash` · `role` enum
(`ADMIN`/`USER`, default `USER`) · `created_at`

`role` is **not** on `CreateUserDto` (and therefore not on `UpdateUserDto`, which derives
from it) on purpose: signup is public, so a settable role would let anyone mint an admin.
`forbidNonWhitelisted` turns a client-sent `role` into a 400. The value comes from the
entity/column default; promoting an admin is an out-of-band act — use
`pnpm set-role <email> ADMIN` (`src/scripts/set-role.ts`, a Nest application context with
no HTTP listener, so it reuses the app's validated config and DB connection). The `Role` enum lives in `src/auth/enums/roles.enum.ts`.
The JWT payload carries `{ sub, email, role }`, so `request.user.role` is available to
guards without a DB read — at the cost of a role change not taking effect until the
user's current token expires.

`profiles`: `id` · `user_id` unique FK→users (CASCADE) · `username` unique varchar(30),
lowercase/digits/underscore · `display_name` · `bio` (280, null) · `avatar_url` (null) ·
timestamps. **Created inside the same transaction as the user** (`UserService.create`), so
every user always has one and the frontend never handles a missing profile. The username
is derived from the email local part, sanitised, and suffixed until free.

`collections`: `id` · `user_id` FK→users (CASCADE) · `name` varchar(60) · `description`
(280, null) · timestamps. Unique on `(user_id, name)` — two users may both have "Lo-fi".

`beats`: `id` · `user_id` FK→users (CASCADE) ·
`collection_id` FK→collections (**SET NULL**, so deleting a collection unfiles its beats
rather than destroying work) · `title` varchar(100) · `data` **json** · timestamps.

`data` holds Pulse's `SavedState` v2 verbatim — `{version, bpm, activeKit, tracks[]}`,
defined in `visual-sequencer/src/app/state/storage.service.ts`. The server stores it
**opaquely**: it validates only that `version` is a positive integer and that the payload
is under 256 KB. The frontend owns that schema and its migrations, so modelling tracks and
steps relationally here would mean a server change for every frontend tweak. Note this
also means `data` must NOT be validated as a nested DTO — the global `whitelist` would
strip every property that isn't declared.

**Naming — settled (2026-08-22):** `Beat` is the name, confirmed by Adi. Pulse's glossary
(`visual-sequencer/claude-docs/02-glossary.md`, Locked) calls the saved unit a *Pattern*
and lists "beat" as a term to avoid, but that entry is about **Step**, not about a titled
and owned save. Server-side the noun is `Beat`; if the frontend adds its own type for it,
add "Beat" to the glossary rather than renaming here.

Ownership is enforced in the services, not a guard: every collection/beat method takes the
caller's id and throws `ForbiddenException` on someone else's row.

## Config

`.env` at repo root, gitignored, loaded globally by ConfigModule. `.env.example` is the
committed schema. Keys: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
— all `DB_`-prefixed so they can't collide with OS/CI variables (`@nestjs/config` does
**not** override variables already present in the environment).
`CLIENT_DIST` (optional) serves the built frontend; `TRUST_PROXY` (optional) is the proxy
hop count that rate limiting counts by.
Auth adds `JWT_SECRET` (>= 32 chars), `JWT_EXPIRES_IN`, plus `JWT_REFRESH_SECRET`
(a **different** secret, >= 32 chars), `JWT_REFRESH_EXPIRES_IN` (e.g. `7d`) and
`CORS_ORIGIN` (comma-separated; `credentials: true` forbids `*`).
**`NODE_ENV` is required** (`development` | `test` | `production`, enum-validated). Both
the CORS allowlist and the refresh cookie's `secure`/`SameSite` flags key off it, so an
unset value would silently accept every loopback origin *and* ship the cookie without
`Secure`. It fails at boot instead. `start:prod` sets it explicitly; anything else reads
it from `.env`.
CORS (`src/config/cors.ts`) allows loopback origins only when `NODE_ENV` is
`development` or `test` — an unrecognised value fails closed. Origins are parsed with
`new URL()` rather than pattern-matched, so `https://localhost:4200` and
`http://localhost` work while `localhost.evil.com` and `http://localhost:4200@evil.com`
do not.
`validateEnv` (`src/config/env.validation.ts`) checks them at boot, so a missing or
malformed key fails startup instead of surfacing as a connection error later.
Env values are always strings: use `Number(config.get('DB_PORT'))`, since
`config.get<number>()` is an assertion, not a conversion.
**Schema: `synchronize` in development, migrations in production.**
`synchronize: true` rewrites the schema to match the entities on every boot — handy on a
throwaway dev database, data loss on a real one, because a renamed or removed property
drops the column and the rows in it go with it. So `synchronize` is now
`NODE_ENV !== 'production'`, and production gets `migrationsRun: true` instead: pending
migrations apply at boot, so the app can never serve against a schema older than the code.
That is safe for the single instance a VPS runs; revisit before running more than one.

Generating a migration diffs the entities against a **live** database, so it needs one to
connect to — and if that database already matches, you get "No changes". Generate against
an empty one instead. The CLI reads `src/config/data-source.ts`, which takes the same
`.env` through `node --env-file` (no dotenv dependency), so the CLI and the app can never
describe different databases. Override a single value for a one-off run:
`DB_NAME=scratch pnpm typeorm migration:generate src/migrations/Foo`.

Development keeps using `synchronize`, so the dev database never has migrations run
against it: its `migrations` table stays empty, and that is expected, not a problem.
Never print or commit `.env` values.

## Conventions

- One folder per feature under `src/<feature>/` with `.module.ts`, `.controller.ts`, `.service.ts`, `dto/`, `entities/`.
- Controllers stay thin — all logic in services. Services are `@Injectable()`, injected via constructor.
- DTO filenames are kebab-case everywhere (`create-user.dto.ts`, `create-profile.dto.ts`),
  matching the Nest CLI default.
- Update DTOs are derived, never duplicated: `PartialType(CreateXDto)` copies the fields
  *and* their validation metadata as optional.
- Imports inside `src/` are **relative** (`../auth/enums/roles.enum`), never `src/`-prefixed.
  `tsconfig`'s `baseUrl: "./"` makes `from 'src/...'` compile, but Jest resolves modules
  itself (`rootDir: src`, no mapper) and fails the suite with "Cannot find module".
- Errors: throw Nest HTTP exceptions (`ConflictException`, `NotFoundException`) rather than returning strings.

## Known issues / good next steps

See `LEARNING-PLAN.md` for the full ordered roadmap. **Phases 0–4 are done**: CRUD on both
modules is real and throws proper HTTP exceptions, request bodies are validated, env keys
are namespaced and validated at boot, and the tests assert behavior.

**Phase 5 (auth) is done too**: signup/signin/signout issue and verify JWTs, and a global
guard protects everything not marked `@Public()`. Rotating refresh tokens, revocation and
reuse detection are in as well — see "Refresh tokens & sessions", which is the authority on
how sessions actually work. Neither suite needs a live MySQL.

**Pulse domain (2026-08-20)**: profiles, collections and beats are in, with ownership
checks throughout. **Current totals: `pnpm test` 84 unit, `pnpm test:e2e` 18 e2e.**

The frontend is a live consumer as of 2026-09-24: Pulse saves a beat with `POST /beats` and
updates it with `PATCH /beats/:id`. Changing a `/beats` shape now breaks a running client.

Decisions Adi settled on 2026-08-22 — treat these as closed, do not re-litigate:
1. The entity is **`Beat`** (see Naming under Data model).
2. **Profiles are never public.** Every `/profiles/*` route requires a token, including
   `GET /profiles/:username`. Do not add `@Public()` to that controller.
3. **A beat belongs to exactly one collection** (`collection_id`, nullable while unfiled).
   No join table, no multi-collection membership.
4. **Pagination** is in (2026-08-22): see the Pagination section. Adi is building the
   frontend side against `{items, meta}`.

Remaining — Phase 6 (production shape), plus auth follow-ups:

1. No `docker-compose.yml` for MySQL, no API **versioning**, no Swagger. `README.md` is
   still stock Nest boilerplate — but see `DEPLOY.md` for the Hostinger VPS runbook.

**Every error has one shape** (`common/filters/all-exceptions.filter.ts`):

```json
{ "statusCode": 409, "message": "...", "error": "Conflict",
  "path": "/api/auth/signup", "timestamp": "2026-11-19T..." }
```

`message` is passed through untouched, including the array `ValidationPipe` produces — the
frontend reads it to explain a 400, so tidying it into one string would blank those
messages. Anything that is not an `HttpException` is a bug rather than a refusal: it
becomes a flat 500 saying nothing, while the real error and its stack go to the log. A
`QueryFailedError` carries the SQL, the column names and the parameters, and none of that
belongs in a response. 4xx is not logged; it is the client being told no.

**CI** (`.github/workflows/ci.yml`) runs on every pull request and every push to `main`:
install, `lint:check`, `typecheck`, both suites, then `build`. It needs no MySQL and no
`.env` — the suites use in-memory fakes and the e2e module supplies its own ConfigService.

It runs `lint:check`, not `lint`, deliberately. `lint` passes `--fix`, so an auto-fixable
violation (formatting, mostly) gets rewritten in the runner and the job exits 0: the build
goes green while the committed code stays unformatted. Non-fixable errors fail either way
— it is the fixable ones that would slip through.

**Closed 2026-11-19**: `/user/*` ownership and the roles gap — the controller is ADMIN-only
(see the note under Routes); `RolesGuard` no longer throws without `@Roles`; and
`synchronize` no longer runs in production (see Config).

## Working agreement

- Explain Nest concepts briefly when introducing them — this is a learning repo.
- Prefer small, incremental changes over large rewrites.
- When the project structure changes (new module, new route, entity, or env key), update this file.
