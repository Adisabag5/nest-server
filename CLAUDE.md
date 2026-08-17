# CLAUDE.md — nest-server

Learning project: a small NestJS REST server. Owner: Adi. Goal is learning Nest
fundamentals (modules / controllers / services / DI / DTOs / TypeORM), not production.

**How to use this file:** it is the index. Read it first, then open only the 1–3 files
you need from the map below. Do not scan `src/` or run `find`. Never read
`node_modules/`, `dist/`, `pnpm-lock.yaml`.

## Stack

Node 25 (`.nvmrc`) · TypeScript 5.7 (ESM `nodenext`, `strictNullChecks` on, `noImplicitAny` off)
NestJS 11 · TypeORM + MySQL (`mysql2`) · `@nestjs/config` · `bcrypt` · `class-transformer` +
`class-validator` · Jest + Supertest · pnpm 10.33 (pinned via `packageManager`)

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
  app.module.ts            root: ConfigModule(global, validated) + TypeOrmModule.forRootAsync + ProfilesModule + UserModule
  app.controller.ts        GET /  -> "Hello World!"
  app.service.ts
  config/env.validation.ts EnvironmentVariables class + validateEnv(); fails boot on a bad .env
  profiles/                IN-MEMORY module (no DB) — the "learn the basics" module
    profiles.controller.ts CRUD routes under /profiles
    profiles.service.ts    Profile[] array seeded with 3 records; exports `Profile` interface
    profiles.module.ts
    dto/create-profile.dto.ts   (class-validator decorators)
    dto/update-profile.dto.ts   PartialType(CreateProfileDto)
  user/                    DB-BACKED module (TypeORM) — the "learn persistence" module
    user.controller.ts     CRUD routes under /user
    user.service.ts        full CRUD; hashes passwords, 409 on duplicate email, 404 on missing
    user.module.ts         TypeOrmModule.forFeature([User])
    entities/user.entity.ts   @Entity('users'); @Exclude() on passwordHash
    dto/create-user.dto.ts, dto/update-user.dto.ts (PartialType)
test/app.e2e-spec.ts       e2e for GET / and the /profiles routes; no DB required
```

## Routes

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/` | AppController.getHello | |
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
are namespaced and validated at boot, and the tests assert behavior (`pnpm test` 19 unit,
`pnpm test:e2e` 6 e2e, neither needs a live MySQL).

Remaining, in order — Phase 5 (auth) then Phase 6 (production shape):

1. No auth at all: bcrypt hashes are stored with nowhere to log in. Next lesson is an
   `AuthModule` with `POST /auth/login` issuing a JWT (`@nestjs/jwt`), then a global
   `JwtAuthGuard` plus a `@Public()` decorator for the open routes.
2. `synchronize: true` still rewrites the schema from the entities — migrations come next.
3. No `docker-compose.yml` for MySQL, no global exception filter, no `api` prefix or
   versioning, no Swagger, no health check, no CI. `README.md` is still stock Nest boilerplate.

## Working agreement

- Explain Nest concepts briefly when introducing them — this is a learning repo.
- Prefer small, incremental changes over large rewrites.
- When the project structure changes (new module, new route, entity, or env key), update this file.
