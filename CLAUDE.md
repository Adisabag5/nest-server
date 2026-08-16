# CLAUDE.md — nest-server

Learning project: a small NestJS REST server. Owner: Adi. Goal is learning Nest
fundamentals (modules / controllers / services / DI / DTOs / TypeORM), not production.

**How to use this file:** it is the index. Read it first, then open only the 1–3 files
you need from the map below. Do not scan `src/` or run `find`. Never read
`node_modules/`, `dist/`, `pnpm-lock.yaml`.

## Stack

Node 22 · TypeScript 5.7 (ESM `nodenext`, `strictNullChecks` on, `noImplicitAny` off)
NestJS 11 · TypeORM + MySQL (`mysql2`) · `@nestjs/config` · `bcrypt` · `class-transformer` · Jest + Supertest · pnpm

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
  main.ts                  bootstrap; listens on process.env.PORT ?? 3000
  app.module.ts            root: ConfigModule(global) + TypeOrmModule.forRootAsync + ProfilesModule + UserModule
  app.controller.ts        GET /  -> "Hello World!"
  app.service.ts
  profiles/                IN-MEMORY module (no DB) — the "learn the basics" module
    profiles.controller.ts CRUD routes under /profiles
    profiles.service.ts    Profile[] array seeded with 3 records; exports `Profile` interface
    profiles.module.ts
    dto/CreateProfileDto.ts, dto/UpdateProfileDto.ts   (plain classes, no validation)
  user/                    DB-BACKED module (TypeORM) — the "learn persistence" module
    user.controller.ts     CRUD routes under /user
    user.service.ts        only create() is real; rest are scaffold stubs
    user.module.ts         TypeOrmModule.forFeature([User])
    entities/user.entity.ts   @Entity('users')
    dto/create-user.dto.ts, dto/update-user.dto.ts (PartialType)
test/app.e2e-spec.ts       e2e for GET /
```

## Routes

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/` | AppController.getHello | |
| GET | `/profiles` | ProfilesService.findAll | in-memory |
| GET | `/profiles/:id` | findOne | |
| POST | `/profiles` | createProfile | returns created profile |
| PUT | `/profiles/:id` | updateProfile | full replace |
| DELETE | `/profiles/:id` | deleteProfile | |
| POST | `/user` | UserService.create | hashes password (bcrypt, 10 rounds); 409 on duplicate email |
| GET | `/user` | findAll | |
| GET | `/user/:id` | findOne | 404 if missing |
| PATCH | `/user/:id` | update | 404 if missing, 409 on duplicate email; re-hashes `password` |
| DELETE | `/user/:id` | remove | 404 if missing |

`id` params are **strings** end-to-end (`User.id` is `bigint`, which TypeORM maps to string).
`passwordHash` never reaches a response: `@Exclude()` on the entity + a global
`ClassSerializerInterceptor` registered in `main.ts`.

## Data model

`users` table (`src/user/entities/user.entity.ts`):
`id` bigint PK auto · `email` varchar(100) unique · `password_hash` · `created_at`

`Profile` (interface, in-memory only): `id` uuid · `name` · `description`

## Config

`.env` at repo root, gitignored, loaded globally by ConfigModule. Keys:
`PORT`, `HOST`, `DB_PORT`, `USERNAME`, `PASSWORD`, `DATABASE_NAME`.
Note the keys have spaces before `=` (e.g. `HOST =...`) — dotenv tolerates it.
TypeORM runs with `synchronize: true` and `autoLoadEntities: true` (fine for learning; schema auto-syncs).
Never print or commit `.env` values.

## Conventions

- One folder per feature under `src/<feature>/` with `.module.ts`, `.controller.ts`, `.service.ts`, `dto/`, `entities/`.
- Controllers stay thin — all logic in services. Services are `@Injectable()`, injected via constructor.
- DTO filenames are inconsistent on purpose-by-accident: `user/` uses kebab-case
  (`create-user.dto.ts`), `profiles/` uses PascalCase (`CreateProfileDto.ts`). Kebab-case
  (Nest CLI default) is preferred for new code.
- Errors: throw Nest HTTP exceptions (`ConflictException`, `NotFoundException`) rather than returning strings.

## Known issues / good next steps

See `LEARNING-PLAN.md` for the full ordered roadmap. Phase 0 and Phase 1 are done —
CRUD on both modules is real, throws proper HTTP exceptions, and `pnpm test` is green
(5 scaffold suites, wired with a mocked repository). Remaining, in order:

1. No `ValidationPipe` / `class-validator` — DTOs are not validated at runtime, so
   `POST /user` with an empty body reaches `bcrypt.hash(undefined, 10)` and 500s.
   Adding `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))` in `main.ts`
   is the next lesson (plan Phase 2).
2. `profiles/dto/*` still uses PascalCase filenames and hand-duplicates fields instead of
   `PartialType(CreateProfileDto)`.
3. Env keys are unnamespaced (`HOST`, `USERNAME`, `PASSWORD`) and unvalidated; no `.env.example`.
4. The specs only assert `toBeDefined()` — no behavior tests for the branches added in Phase 1.
5. `test/app.e2e-spec.ts` imports the real `AppModule`, so it needs a live MySQL to run.

## Working agreement

- Explain Nest concepts briefly when introducing them — this is a learning repo.
- Prefer small, incremental changes over large rewrites.
- When the project structure changes (new module, new route, entity, or env key), update this file.
