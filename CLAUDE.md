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

Node 25 (`.nvmrc`) · TypeScript 5.7 (ESM `nodenext`, `strictNullChecks` on, `noImplicitAny` off)
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
| scaffold | `nest g resource <name>` |
| promote/demote a user | `pnpm set-role <email> <ADMIN\|USER>` |
| typecheck everything | `npx tsc --noEmit` (`pnpm build` skips `*.spec.ts`) |

## File map

```
src/
  main.ts                  bootstrap; global ValidationPipe + ClassSerializerInterceptor; PORT ?? 3000
  app.module.ts            root: ConfigModule(global, validated) + TypeOrmModule.forRootAsync + Profiles/User/AuthModule
  app.controller.ts        GET / -> "Hello World!" (@Public)
  app.service.ts
  config/env.validation.ts EnvironmentVariables class + validateEnv(); fails boot on a bad .env
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
  beat/                    STUB — a saved pattern; Adi will finish this
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
| GET | `/` | AppController.getHello | `@Public()` |
| POST | `/auth/signup` | AuthService.signup | `@Public()`; 201 + `{access_token, user}`; 409 on duplicate |
| POST | `/auth/signin` | AuthService.signIn | `@Public()`; **200** (nothing created); 401 on bad credentials |
| POST | `/auth/refresh` | AuthService.refresh | `@Public()` + `JwtRefreshGuard`; **200**; rotates the cookie |
| POST | `/auth/signout` | AuthService.signOut | cookie-authenticated; revokes **this** session only |
| GET | `/profiles/me` | ProfileService.findByUserId | own profile |
| PATCH | `/profiles/me` | update | 409 if the username is taken |
| GET | `/profiles/:username` | findByUsername | 404 if missing |
| POST | `/collections` | CollectionService.create | 409 on a duplicate name for that user |
| GET | `/collections` | findAllForUser | only the caller's |
| GET/PATCH/DELETE | `/collections/:id` | | 404 if missing, **403** if not yours; DELETE is 204 |
| POST | `/beats` | BeatService.create | 400 unless `data.version` is a positive int |
| GET | `/beats` | findAllForUser | `?collectionId=` filters |
| GET/PATCH/DELETE | `/beats/:id` | | 404 if missing, **403** if not yours; DELETE is 204 |
| POST | `/user` | UserService.create | hashes password (bcrypt, 10 rounds); 409 on duplicate email |
| GET | `/user` | findAll | |
| GET | `/user/:id` | findOne | 404 if missing |
| PATCH | `/user/:id` | update | 404 if missing, 409 on duplicate email; re-hashes `password` |
| DELETE | `/user/:id` | remove | 404 if missing |

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

- Cookie flags: `httpOnly` always; `secure` + `SameSite=None` only when
  `NODE_ENV=production` (a cross-site Vercel frontend needs None, which requires Secure);
  `SameSite=Lax` locally. `Path=/auth` so ordinary API calls never carry it.
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

`beats` (**stub — Adi is finishing this**): `id` · `user_id` FK→users (CASCADE) ·
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
Auth adds `JWT_SECRET` (>= 32 chars), `JWT_EXPIRES_IN`, plus `JWT_REFRESH_SECRET`
(a **different** secret, >= 32 chars), `JWT_REFRESH_EXPIRES_IN` (e.g. `7d`) and
`CORS_ORIGIN` (comma-separated; `credentials: true` forbids `*`).
`validateEnv` (`src/config/env.validation.ts`) checks them at boot, so a missing or
malformed key fails startup instead of surfacing as a connection error later.
Env values are always strings: use `Number(config.get('DB_PORT'))`, since
`config.get<number>()` is an assertion, not a conversion.
TypeORM runs with `synchronize: true` and `autoLoadEntities: true` (fine for learning; schema auto-syncs).
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
guard protects everything not marked `@Public()`. `pnpm test` 31 unit, `pnpm test:e2e` 16
e2e, neither needs a live MySQL.

**Pulse domain (2026-08-20)**: profiles, collections and a stub beats module are in, with
ownership checks and 55 unit + 17 e2e tests.

Decisions Adi settled on 2026-08-22 — treat these as closed, do not re-litigate:
1. The entity is **`Beat`** (see Naming under Data model).
2. **Profiles are never public.** Every `/profiles/*` route requires a token, including
   `GET /profiles/:username`. Do not add `@Public()` to that controller.
3. **A beat belongs to exactly one collection** (`collection_id`, nullable while unfiled).
   No join table, no multi-collection membership.

Still open:
4. No pagination anywhere — `GET /beats` returns every beat the user owns.

Remaining — Phase 6 (production shape), plus auth follow-ups:

1. No refresh tokens and no revocation: a signed JWT stays valid until it expires, so
   `signout` is client-side only. A denylist or short access + refresh tokens is the fix.
2. No roles/permissions — the guard answers "who are you", not "what may you do".
   Nothing stops user A from `PATCH /user/<B's id>`.
3. `synchronize: true` still rewrites the schema from the entities — migrations come next.
4. No `docker-compose.yml` for MySQL, no global exception filter, no `api` prefix or
   versioning, no Swagger, no health check, no CI. `README.md` is still stock Nest boilerplate.

## Working agreement

- Explain Nest concepts briefly when introducing them — this is a learning repo.
- Prefer small, incremental changes over large rewrites.
- When the project structure changes (new module, new route, entity, or env key), update this file.
