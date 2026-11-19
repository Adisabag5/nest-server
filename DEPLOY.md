# Deploying Pulse to a Hostinger VPS

One origin: the NestJS server serves the API under `/api` and the built Angular app
everywhere else. One process, one domain, no CORS, and the refresh cookie stays
`SameSite=Lax`.

> **Why a VPS and not Hostinger's web hosting.** The shared/premium tiers are built around
> PHP and give you no way to keep a Node process alive. NestJS needs the VPS tier (which is
> what Hostinger's "Node.js hosting" runs on anyway).

## What runs where

```
                  ┌──────────────── VPS ────────────────┐
  browser ──443──▶│ nginx (TLS)  ──▶  node (port 3000)  │
                  │                      │              │
                  │                      ├─ /api/*   → NestJS
                  │                      └─ anything → index.html
                  │                                     │
                  │                   MySQL ◀───────────┘
                  └─────────────────────────────────────┘
```

nginx is optional on day one — Node can listen on 443 directly — but it is the easier place
to terminate TLS and it is what the rest of this runbook assumes.

## One-time setup

**1. Node and MySQL**

Install Node 25 (`.nvmrc`) and MySQL. Create the database and a user that owns only it:

```sql
CREATE DATABASE pulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pulse'@'localhost' IDENTIFIED BY '<a long random password>';
GRANT ALL PRIVILEGES ON pulse.* TO 'pulse'@'localhost';
FLUSH PRIVILEGES;
```

Do not reuse the dev password, and do not grant anything outside `pulse.*`.

**2. `.env` on the server**

Copy `.env.example` and fill it in. The values that matter in production:

| Key | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Turns `synchronize` **off**, migrations **on**, and `secure` on the cookie. Getting this wrong is the worst single mistake available here. |
| `JWT_SECRET` | `openssl rand -base64 48` | Never the dev value. |
| `JWT_REFRESH_SECRET` | a **different** `openssl rand -base64 48` | A leaked access secret must not mint refresh tokens. |
| `CORS_ORIGIN` | `https://your-domain` | Unused while single-origin, but it is validated at boot, so it must be present and real. |
| `CLIENT_DIST` | `/var/www/pulse/client` | Absolute path to the Angular build. Omit it and the server is API-only. |
| `TRUST_PROXY` | `1` | nginx sits in front, so without it every request looks like it came from nginx and **all visitors share one rate-limit bucket** — a few sign-in attempts would lock out everyone. Omit it if you expose Node directly, or clients can forge `X-Forwarded-For` and dodge the limit. |
| `DB_*` | the database above | |

`validateEnv` fails the boot on a missing or malformed key, so a bad `.env` stops the
server instead of surfacing later as a confusing runtime error.

**3. TLS**

Point the domain at the VPS, then Let's Encrypt via certbot. The refresh cookie is `Secure`
in production, so **without HTTPS nobody can stay signed in** — the browser will refuse to
store it.

## Each deploy

```bash
# 1. Frontend — built wherever you build, copied to CLIENT_DIST
cd visual-sequencer
pnpm install --frozen-lockfile
pnpm build
rsync -a --delete dist/angular-starter-template/browser/ user@vps:/var/www/pulse/client/

# 2. Backend
cd nest-server
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart pulse-api        # or: systemctl restart pulse-api
```

Pending migrations run **at boot** in production (`migrationsRun: true`), so the schema can
never be older than the code. To see what will run before restarting:

```bash
pnpm migration:show
```

### Keeping it alive

```bash
pm2 start dist/main.js --name pulse-api
pm2 save && pm2 startup     # survive a reboot
```

`enableShutdownHooks()` is on, so a `SIGTERM` from pm2 or systemd closes the database pool
and finishes in-flight requests instead of cutting them off.

### nginx

```nginx
server {
  listen 443 ssl http2;
  server_name your-domain;

  # certbot fills these in
  ssl_certificate     /etc/letsencrypt/live/your-domain/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Checking it worked

```bash
curl https://your-domain/api/health      # {"status":"ok","database":"up"}
# eleventh sign-in attempt in a minute should be 429, not 401
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code} " -X POST \
  https://your-domain/api/auth/signin -H 'Content-Type: application/json' \
  --data '{"email":"nobody@example.invalid","password":"wrong"}'; done; echo
curl -I https://your-domain/             # 200, text/html
curl -I https://your-domain/auth         # 200 — deep links reach the router
```

Then sign in through the UI and reload the page. If the session survives the reload, the
refresh cookie is being set and returned correctly, which exercises TLS, the cookie flags
and the `/api/auth` path in one go.

## First admin

Roles are not settable through the API — signup is public, so a settable role would let
anyone mint an admin. Promote out of band, on the server:

```bash
pnpm set-role you@example.com ADMIN
```

## Things that will bite

- **`NODE_ENV` not `production`.** `synchronize` comes back on and TypeORM will reshape the
  schema to match the entities, dropping columns and their data. Check it first, every time.
- **No HTTPS.** The cookie is `Secure`; sessions silently never persist.
- **`CLIENT_DIST` pointing at `dist/angular-starter-template` instead of its `browser/`
  subdirectory.** Angular puts `index.html` one level down. The server refuses to boot
  rather than serve nothing, so you will see this immediately.
- **A stale `dist/`.** `pnpm build` before restarting; pm2 runs the compiled output, not
  the sources.
- **`TRUST_PROXY` unset behind nginx.** Sign-in is limited to 10 attempts a minute *per IP*,
  and without this every visitor counts as the same IP. The symptom is users getting 429s
  they did nothing to deserve.
- **Rate-limit counts are per process and in memory.** Restarting clears them, and a second
  instance would double the real limit. Fine for one VPS; not fine the day you scale out.
