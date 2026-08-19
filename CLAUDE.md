# CLAUDE.md — nest-server

Learning project: a small NestJS REST server. Owner: Adi. Goal is learning Nest
fundamentals (modules / controllers / services / DI / DTOs / TypeORM), not production.

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

## File map

```
src/
  main.ts                  bootstrap; global ValidationPipe + ClassSerializerInterceptor; PORT ?? 3000
  app.module.ts            root: ConfigModule(global, validated) + TypeOrmModule.forRootAsync + Profiles/User/AuthModule
  app.controller.ts        GET / -> "Hello World!" (@Public)
  app.service.ts
  config/env.validation.ts EnvironmentVariables class + validateEnv(); fails boot on a bad .env
  auth/                    AUTH module — JWT issue + verify
    auth.controller.ts     POST /auth/signup, /auth/signin, /auth/signout
    auth.service.ts        bcrypt.compare + jwtService.signAsync; reuses UserService.create
    auth.module.ts         imports UserModule + JwtModule.registerAsync; registers APP_GUARD
    dto/sign-in.dto.ts     email + non-empty password (no policy rules — see below)
    strategies/jwt.strategy.ts  passport-jwt; Bearer header, validates signature + expiry
    guards/jwt-auth.guard.ts    global guard; lets @Public() routes through
    decorators/public.decorator.ts  @Public() -> SetMetadata(IS_PUBLIC_KEY, true)
  profiles/                IN-MEMORY module (no DB) — the "learn the basics" module
    profiles.controller.ts CRUD routes under /profiles
    profiles.service.ts    Profile[] array seeded with 3 records; exports `Profile` interface
    profiles.module.ts
    dto/create-profile.dto.ts   (class-validator decorators)
    dto/update-profile.dto.ts   PartialType(CreateProfileDto)
  user/                    DB-BACKED module (TypeORM) — the "learn persistence" module
    user.controller.ts     CRUD routes under /user
    user.service.ts        full CRUD; hashes passwords, 409 on duplicate email, 404 on missing;
                         findByEmail() returns null (login's lookup, must not 404)
    user.module.ts         TypeOrmModule.forFeature([User]); exports UserService for AuthModule
    entities/user.entity.ts   @Entity('users'); @Exclude() on passwordHash
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
| POST | `/auth/signout` | AuthService.signOut | needs a token; stateless — client discards it |
| GET | `/profiles` | ProfilesService.findAll | in-memory |
| GET | `/profiles/:id` | findOne | |
| POST | `/profiles` | createProfile | returns created profile |
| PUT | `/profiles/:id` | updateProfile | merges; URL id wins, 404 if missing |
| DELETE | `/profiles/:id` | deleteProfile | |
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
`id` bigint PK auto · `email` varchar(100) unique · `password_hash` · `created_at`

`Profile` (interface, in-memory only): `id` uuid · `name` · `description`

## Config

`.env` at repo root, gitignored, loaded globally by ConfigModule. `.env.example` is the
committed schema. Keys: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
— all `DB_`-prefixed so they can't collide with OS/CI variables (`@nestjs/config` does
**not** override variables already present in the environment).
Auth adds `JWT_SECRET` (>= 32 chars) and `JWT_EXPIRES_IN` (e.g. `1h`).
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
- Errors: throw Nest HTTP exceptions (`ConflictException`, `NotFoundException`) rather than returning strings.

## Known issues / good next steps

See `LEARNING-PLAN.md` for the full ordered roadmap. **Phases 0–4 are done**: CRUD on both
modules is real and throws proper HTTP exceptions, request bodies are validated, env keys
are namespaced and validated at boot, and the tests assert behavior.

**Phase 5 (auth) is done too**: signup/signin/signout issue and verify JWTs, and a global
guard protects everything not marked `@Public()`. `pnpm test` 31 unit, `pnpm test:e2e` 16
e2e, neither needs a live MySQL.

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
