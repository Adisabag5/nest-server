# CLAUDE.md — nest-server

Learning project: a small NestJS REST server. Owner: Adi. Goal is learning Nest
fundamentals (modules / controllers / services / DI / DTOs / TypeORM), not production.

**How to use this file:** it is the index. Read it first, then open only the 1–3 files
you need from the map below. Do not scan `src/` or run `find`. Never read
`node_modules/`, `dist/`, `pnpm-lock.yaml`.

## Stack

Node 22 · TypeScript 5.7 (ESM `nodenext`, `strictNullChecks` on, `noImplicitAny` off)
NestJS 11 · TypeORM + MySQL (`mysql2`) · `@nestjs/config` · `bcrypt` · Jest + Supertest · pnpm

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
| POST | `/user` | UserService.create | hashes password (bcrypt, 10 rounds), returns user w/o hash |
| GET | `/user` | findAll | **stub — returns a string** |
| GET | `/user/:id` | findOne | **stub** |
| PATCH | `/user/:id` | update | **stub / buggy, see below** |
| DELETE | `/user/:id` | remove | **stub** |

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

1. `UserService.update()` — checks `findOneBy({id})` and throws `ConflictException('Email already registered')`
   when the user **exists**. Logic is inverted and the message is wrong; should be `NotFoundException` when missing,
   then actually persist the update.
2. `UserService.findAll/findOne/remove` are still CLI-generated string stubs.
3. `ProfilesService` returns the string `'Not fount'` (typo) on miss instead of throwing `NotFoundException`.
4. No `ValidationPipe` / `class-validator` — DTOs are not validated at runtime. Adding
   `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))` in `main.ts` is the natural next lesson.
5. Only scaffold "should be defined" tests exist. `user.*.spec.ts` will fail once the repository token is
   required — they need a mocked `getRepositoryToken(User)` provider.
6. `git` repo has no commits yet (branch `main`, no remote) — everything is untracked.

## Working agreement

- Explain Nest concepts briefly when introducing them — this is a learning repo.
- Prefer small, incremental changes over large rewrites.
- When the project structure changes (new module, new route, entity, or env key), update this file.
