# LEARNING-PLAN.md — nest-server

An ordered roadmap for finishing this project. Ordered by **learning sequence**, not by
severity: each step should only require concepts you already have, and should make the
next step easier to understand.

**Rule for the whole list:** do one numbered item at a time, run it, see it work, commit.
Never batch two lessons into one commit — when something breaks you want exactly one
suspect.

Legend: ✅ = done · 🟢 = do now · 🔵 = soon · ⚪️ = polish / later.

**Status (2026-08-17):** Phases 0–4 are complete — items 1–18 all landed, each as its own
commit. CRUD is real on both modules, request bodies are validated at the boundary, env
keys are namespaced and checked at boot, and both suites run without a live MySQL
(19 unit + 6 e2e). **Phase 5 — auth — is next.**

---

## Phase 0 — Safety net (5 minutes, before touching any code) ✅

### 1. ✅ Make the initial git commit

The repo has a `main` branch with **zero commits**. Everything is untracked.

```bash
git add -A && git commit -m "chore: initial commit — Nest scaffold, profiles + user modules"
```

**Principle — a checkpoint is what makes experimentation cheap.** Learning is mostly
"try it, be wrong, revert." Without a commit you have nothing to revert *to*, so every
experiment carries the risk of losing working code, and you subconsciously stop
experimenting. Commit before each numbered item below, and `git diff` after — the diff
is the single best review tool you have for spotting what a change actually touched
versus what you thought it touched.

Verified: `.gitignore` already excludes `.env`, `dist/`, `node_modules/`, so `git add -A`
is safe here.

### 2. ✅ Move `@types/bcrypt` to devDependencies

It sits in `dependencies` in `package.json`.

**Principle — dependencies are a runtime contract.** `dependencies` is "what my code
needs to *run* in production"; `devDependencies` is "what I need to *build and test* it."
Type packages vanish at compile time, so they are never runtime deps. Getting this
habit early means your production image stays small and your dependency list stays
honest about what actually ships.

---

## Phase 1 — Finish the basic CRUD ✅

This is the goal you named. Everything here is about making `user/` and `profiles/`
behave like real REST resources. Nothing here needs a new library.

### 3. ✅ Fix the inverted logic in `UserService.update()`

Current code (`src/user/user.service.ts`):

```ts
async update(id: string, updateUserDto: UpdateUserDto) {
  const existing = await this.userRepo.findOneBy({ id })
  if (existing) throw new ConflictException('Email already registered');   // ← backwards
  return `This action updates a #${id} user`;                              // ← never persists
}
```

It throws when the user **is found**, and the message describes a different failure.
It should throw when the user is **missing**, then persist.

**Principle — HTTP status codes are your API's error vocabulary, and each one means
exactly one thing.** `404 Not Found` = "the thing you addressed doesn't exist."
`409 Conflict` = "the thing you addressed exists, and what you asked for would violate
a rule about it" (here: email uniqueness). They are not interchangeable. A client — or
future-you writing a frontend — branches on the status code, so a wrong code is a
lie that propagates. `create()` already gets this right (`ConflictException` on
duplicate email); `update()` copy-pasted the guard without re-reading what it guards.

The secondary lesson is the **guard clause**: check the bad case, throw, and let the
happy path continue unindented. Read the guard out loud — "if the user exists, throw
not-found" — and the bug is audible.

### 4. ✅ Implement `findAll()`, `findOne()`, `remove()` in `UserService`

All three are still Nest CLI string stubs (`return \`This action returns all user\``).

```ts
findAll() {
  return this.userRepo.find();
}

async findOne(id: string) {
  const user = await this.userRepo.findOneBy({ id });
  if (!user) throw new NotFoundException(`User ${id} not found`);
  return user;
}

async remove(id: string) {
  const result = await this.userRepo.delete(id);
  if (result.affected === 0) throw new NotFoundException(`User ${id} not found`);
}
```

**Principle — the service owns persistence; the controller only owns HTTP.** The
repository (`this.userRepo`) is TypeORM's implementation of the *repository pattern*:
a collection-like object that hides "how rows become objects." Your service talks to
that interface and never writes SQL, which is why you can swap the repository for a
fake in a unit test (step 15) without touching a line of service logic.

Second principle here — **`delete` returns a receipt, not the deleted thing.** Checking
`result.affected === 0` is how you distinguish "deleted it" from "there was nothing
to delete." Silently succeeding on a no-op delete is the classic way to hide a bug
where the client had a stale id.

Note `findAll()` will return password hashes until step 7 — that's intentional
sequencing, you'll see the problem before you fix it.

### 5. ✅ Fix the id type mismatch in `UserController`

```ts
findOne(@Param('id') id: string) { return this.userService.findOne(+id); }  // ← number
remove(@Param('id') id: string)  { return this.userService.remove(+id);  }  // ← number
```

But `User.id` is `@PrimaryGeneratedColumn({ type: 'bigint' })`, which TypeORM maps to
**`string`**, not `number`. Drop the `+` and type the service params as `string`.

**Principle — types must be honest at the boundary, and boundaries are where types get
lost.** Everything arriving over HTTP is a string; TypeScript's annotations are erased
at runtime and cannot check that for you. So a URL param is `string` until *you* convert
it, and the conversion must target whatever the storage layer actually uses. TypeORM
represents `bigint` as a string deliberately — a JS `number` is a float64 and silently
loses precision past 2^53, so `+id` on a large id would produce a value that doesn't
match any row. This bug is invisible in a dev DB with 5 users and catastrophic later.
That's the general shape of boundary bugs: correct-looking, silent, and time-delayed.

### 6. ✅ Make `ProfilesService` throw instead of returning strings

```ts
if (profileIndex === -1) return 'Not fount'   // ← typo, and wrong mechanism
```

Both `updateProfile` and `deleteProfile` do this. `findOne` is worse — it returns
`undefined` on a miss, which Nest serializes as an empty `200 OK`.

Replace with `throw new NotFoundException(...)`.

**Principle — errors travel on a separate channel from results.** Returning `'Not fount'`
where the caller expects a `Profile` forces every caller to inspect the return value and
guess whether it's data or an apology; the type system can't help, and the HTTP layer
sends `200 OK` with the string body, telling the client everything went fine. Throwing
uses the channel built for failure: Nest's exception layer catches `HttpException`
subclasses and maps them to the right status and JSON shape automatically. You write
`throw new NotFoundException()`, the framework writes the 404.

This is the same lesson as step 3, arriving from the opposite direction — there the code
threw the wrong exception, here it doesn't throw at all.

### 7. ✅ Stop leaking `passwordHash`

`create()` strips it by hand:

```ts
const { passwordHash: _, ...result } = saved;
```

…but `findAll()` and `findOne()` (step 4) will happily return it. Fix properly with
`@Exclude()` on the entity field plus `ClassSerializerInterceptor` globally.

```ts
// user.entity.ts
@Exclude()
@Column({ name: 'password_hash' })
passwordHash!: string;

// main.ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

**Principle — the entity is not the API contract.** They *look* the same today, which is
exactly the trap. The entity's job is to describe a database row; the response's job is
to describe what a client is allowed to see. As soon as you hand the entity straight to
the client, every future column you add is published by default — the safe direction is
opt-out-by-default, decided once, at the serialization layer. Doing it per-handler with
destructuring means the rule lives in N places and step 4 has already proven you'll
forget one of them.

### 8. ✅ Fix `updateProfile`'s signature and stop trusting the body's `id`

Two coupled problems:

- `updateProfile(id: string, profile: Profile)` is typed `Profile`, but the controller
  passes an `UpdateProfileDto`. It compiles only because the shapes coincide.
- `UpdateProfileDto` contains `id`, and the method assigns the whole body over the stored
  record — so a client can `PUT /profiles/abc` with `{"id": "xyz", ...}` and rewrite that
  profile's identity.

Remove `id` from `UpdateProfileDto`, and merge instead of replace:

```ts
this.profiles[profileIndex] = { ...this.profiles[profileIndex], ...dto, id };
```

**Principle — the URL carries identity, the body carries data, and identity is never
client-supplied.** This is the single most transferable rule in REST design. The moment
identity can arrive from two places you have an authority question ("which one wins?")
and an authority question is a security question. The general form — *never let the
payload decide which record it applies to* — is the same bug class as mass-assignment
vulnerabilities, and step 9's `whitelist: true` is the systematic defense.

### 9. ✅ Delete the leftover `console.log({ id })` in `ProfilesController.delete`

**Principle — use the framework's logger, not `console`.** Nest's `Logger` gives you
levels, a context tag, and one place to redirect output when you later ship structured
JSON logs. `console.log` in a request handler is a debugging tool that escaped; it can't
be filtered by level, and it will eventually print something you didn't intend to
persist. If you want it while developing: `private readonly logger = new Logger(ProfilesController.name)`
then `this.logger.debug({ id })`.

**✅ At the end of Phase 1 your CRUD is real. This is the natural place to stop, commit,
and tag it.** Everything below is a new concept rather than a completion of an old one.

---

## Phase 2 — The input trust boundary ✅

Phase 1 made your handlers correct *given good input*. Phase 2 stops assuming good input.
It comes second on purpose: validation errors are much easier to reason about once the
happy path is known-correct.

### 10. Add `ValidationPipe` + `class-validator` / `class-transformer`

Neither library is installed (I checked `node_modules`). Install both, decorate the DTOs,
and turn on the global pipe:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,             // strip properties with no decorator
  forbidNonWhitelisted: true,  // ...or 400 if any are present
  transform: true,             // instantiate the DTO class, coerce types
}));
```

```ts
export class CreateUserDto {
  @IsEmail()      email!: string;
  @MinLength(8)   password!: string;
}
```

**Principle — TypeScript does not exist at runtime.** This is the single biggest
conceptual jump in the list. `createUserDto: CreateUserDto` in your controller signature
is a *compile-time* claim about a variable; at runtime that parameter is whatever JSON
the client posted, including `{"email": {"$ne": null}}` or nothing at all. Right now
`POST /user` with an empty body reaches `bcrypt.hash(undefined, 10)` and throws a 500 —
a server error for what is unambiguously a client mistake.

A `ValidationPipe` closes that gap by making the DTO class do double duty: same
declaration, but the decorators survive compilation as metadata and get *checked* on
every request. That's why Nest wants DTOs to be classes and not interfaces — interfaces
are erased, classes leave a runtime object to hang metadata on.

`whitelist: true` is the systematic version of step 8's fix: any property you didn't
explicitly declare is stripped before your code sees it, so mass-assignment stops being
something you have to remember.

### 11. Derive `UpdateProfileDto` from `CreateProfileDto` with `PartialType`

`user/dto/update-user.dto.ts` already does this correctly:

```ts
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

`profiles/` redeclares every field by hand instead.

**Principle — derive types, don't duplicate them.** Two hand-maintained copies of the
same field list will drift, and the drift shows up as a validation rule that silently
applies on create but not on update. `PartialType` copies the fields *and their
validation metadata*, marking each optional — which is precisely the semantic difference
between POST and PATCH. Nest ships `PartialType`, `PickType`, `OmitType`, and
`IntersectionType` (all confirmed present in `@nestjs/mapped-types`) so you can express
almost any DTO as a transformation of another.

### 12. Rename `profiles/dto/*` to kebab-case

`CreateProfileDto.ts` → `create-profile.dto.ts`, matching `user/`'s convention and the
Nest CLI default.

**Principle — a convention's value is entirely in its consistency.** Neither casing is
better in isolation; having both means every file reference costs a moment of recall,
and `nest g` will keep generating the other one. Pick the generator's default so the
tool and the repo agree.

---

## Phase 3 — Configuration correctness ✅

### 13. Rename the env keys and add `.env.example`

Current keys: `HOST`, `DB_PORT`, `USERNAME`, `PASSWORD`, `DATABASE_NAME`.
Target: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

Then commit a `.env.example` with the keys and dummy values.

**Principle — `process.env` is one flat global namespace shared with the entire
operating system.** `HOST` and `USERNAME` are not yours; CI runners, Docker, and Windows
all set them for their own purposes. And `@nestjs/config` does **not** override variables
that already exist in the environment — so on a machine where `USERNAME` is already set,
your `.env` is silently ignored and the app tries to reach MySQL as some other user. The
failure looks like a credentials problem, which sends you debugging MySQL instead of
config precedence. Prefixing is how you get a private namespace inside a global one.

`.env.example` exists because `.env` is gitignored (correctly): without it, nothing in
the repo documents which keys a fresh clone needs. The example file is the schema; the
real file is the secret.

### 14. Validate env at boot, and coerce `DB_PORT`

```ts
port: Number(config.get('DB_PORT')),
```

`config.get<number>('DB_PORT')` today is a **type assertion, not a conversion** — env
values are always strings, and the generic just tells TypeScript to stop asking. Add
schema validation to `ConfigModule.forRoot({ validate })` so a missing or malformed key
fails at startup.

**Principle — fail fast, and fail at the boundary where the cause is obvious.** An app
with a bad config should refuse to start with "DB_PORT is required," not start happily
and throw an unrelated connection error on the first request an hour later. The distance
between the cause and the symptom is what makes debugging expensive; validating at boot
collapses that distance to zero.

### 15. Pin the toolchain: `packageManager` field + `.nvmrc`

There's a `pnpm-lock.yaml` but nothing in `package.json` declares pnpm — and `pnpm`
wasn't even on the PATH when I checked the repo.

**Principle — the lockfile only pins your dependencies; something has to pin the thing
that reads the lockfile.** Running `npm install` in a pnpm repo produces a second,
conflicting lockfile and a subtly different tree. `"packageManager": "pnpm@x.y.z"` lets
corepack enforce the right tool automatically.

---

## Phase 4 — Make the tests actually run ✅

Deliberately after Phase 1–3: tests written against half-finished behavior get rewritten.

### 16. ✅ Give the specs a mocked repository

*(Done early — pulled forward out of order so `pnpm test` is green at the Phase 1
milestone. The profiles controller spec was also missing `ProfilesService`.)*

`user.service.spec.ts` and `user.controller.spec.ts` register only the service:

```ts
providers: [UserService],   // UserService needs Repository<User> — DI will throw
```

Fix with the injection token:

```ts
providers: [
  UserService,
  { provide: getRepositoryToken(User), useValue: { findOneBy: jest.fn(), save: jest.fn(), find: jest.fn(), delete: jest.fn() } },
],
```

**Principle — this is the payoff for dependency injection, and it's worth pausing on.**
`UserService` never constructs its repository; it *asks* for one via its constructor, and
Nest's container decides what to hand over. Because that decision lives in the container
rather than inside the class, a test can register a different answer under the same token
and the service is none the wiser. That is the whole point of DI — not indirection for
its own sake, but the ability to substitute collaborators at a seam you control.
`getRepositoryToken(User)` is just the string key TypeORM registers its repository under.

Note these specs currently pass only because they assert `toBeDefined()` and nothing
else; they'll start failing the moment they're asked to do real work — which is the
correct outcome, and how you'll know they were never testing anything.

### 17. Write behavior tests for the CRUD from Phase 1

One test per branch you wrote: create-duplicate → 409, findOne-missing → 404,
remove-missing → 404, create → no `passwordHash` in the result.

**Principle — test the observable behavior, not the implementation.** Assert on what a
caller can see (return value, exception type) rather than on which repository method got
called, or the tests break every time you refactor and stop being a safety net. Notice
these tests map one-to-one onto the *decisions* you made in steps 3–7: every `if` that
throws is a branch worth pinning down.

### 18. Give the e2e tests their own database

`test/app.e2e-spec.ts` imports the real `AppModule`, so it needs a live MySQL with the
right credentials or it fails before the first assertion. Override the TypeORM module in
the test fixture, or point it at a disposable database.

**Principle — a test that depends on ambient state isn't a test, it's a coin flip.** The
value of a test suite is that a failure means *your code* changed. Any shared, mutable,
externally-provisioned dependency dilutes that signal into "maybe MySQL isn't running."
Either the test owns its environment or it can't own its verdict.

---

## Phase 5 — Auth: the natural next feature 🟢 ← you are here

You store bcrypt password hashes and have nowhere to log in. This is the first item on
the list that adds a *capability* rather than fixing something, which is why it's here
and not earlier — it leans on every phase above (validation, config, exceptions, tests).

### 19. `AuthModule` — login endpoint issuing a JWT

`@nestjs/jwt`, a `POST /auth/login` that looks up by email and `bcrypt.compare`s.

**Principle — authentication answers "who are you," authorization answers "what may you
do," and conflating them is how access-control bugs are born.** Also: on a failed login,
return the *same* generic 401 whether the email was unknown or the password was wrong.
Distinguishing them turns your login route into an account-enumeration oracle. This is
one place where the "be specific about errors" instinct from step 3 is deliberately
inverted — and knowing *why* the rule flips here is the actual lesson.

### 20. Guards + a `@Public()` decorator

Register a global `JwtAuthGuard`, then mark the handful of open routes.

**Principle — cross-cutting concerns belong in the pipeline, not in every handler.** Nest
gives you middleware → guards → interceptors → pipes → handler → interceptors →
exception filters, and each stage exists so a concern that applies to *many* routes is
declared once. Auth as a global guard is secure-by-default: a new controller is protected
the moment it's created, and exposing it is an explicit, greppable, reviewable act.
Opt-in protection means one forgotten decorator is a breach.

---

## Phase 6 — Production shape ⚪️

Roughly ordered, all optional for a learning repo. Take them when you're curious.

| # | Item | Principle in one line |
|---|---|---|
| 21 | `docker-compose.yml` for MySQL | The environment is part of the code; a README step a human performs is a step a human skips. |
| 22 | Migrations; drop `synchronize: true` | Schema changes need history and review like any code — `synchronize` silently rewrites your DB from whatever the entities happen to say today. |
| 23 | Global exception filter + `Logger` | One place decides the error envelope, so every client sees one shape. |
| 24 | `app.setGlobalPrefix('api')` + versioning | URLs are a contract you can't retract once someone depends on it; leave yourself room to publish v2. |
| 25 | `@nestjs/swagger` | Docs generated from the code can't drift from the code. |
| 26 | `@nestjs/terminus` health check | If you can't ask the service whether it's healthy, you'll find out from a user. |
| 27 | Rewrite `README.md` (still the stock Nest boilerplate) | The setup steps you only know because you lived through them are exactly the ones a newcomer needs. |
| 28 | GitHub Actions CI + husky/lint-staged | A check that runs only when remembered is not a check. |
| 29 | Update `CLAUDE.md` as you go | Your own working agreement already says to — stale docs are worse than none, because they're trusted. |

---

## Suggested commit sequence

```
Phase 0   1 commit    chore: initial commit
Phase 1   7 commits   one per numbered item — this is your CRUD milestone
Phase 2   3 commits
Phase 3   3 commits
Phase 4   3 commits
Phase 5   2 commits
Phase 6   as you go
```

Next session: start at #19 (`AuthModule` + `POST /auth/login`), then #20 (global guard +
`@Public()`). Same rule as before — one item, run it, see it work, commit.
