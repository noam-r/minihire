# minihire

Minimal hiring site for publishing job openings and receiving applications.

## Stack

- Public website: Astro
- Backend and admin UI: PocketBase
- Database and file storage: PocketBase embedded SQLite and file storage
- Email: Resend
- Package manager: pnpm

## Project Structure

```text
.
├── apps/
│   └── web/
├── docs/
│   ├── minihire-requirements.md
│   └── deploy-aws.md
├── docker/
├── pocketbase/
│   ├── pb_hooks/
│   └── pb_migrations/
├── scripts/
├── .env.example
├── package.json
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js 20+ (see `apps/web/package.json` `engines`)
- pnpm
- `curl` and `unzip` for the local PocketBase bootstrap script
- `sqlite3` for backups (host-based restores; optional for Docker volume backups)
- Docker Engine 24+ and Docker Compose v2 (for container deployment)

## Environment

Copy the example file and fill in the real values:

```bash
cp .env.example .env
```

Required variables (see [.env.example](.env.example) for comments):

| Variable | Role |
|----------|------|
| `PUBLIC_SITE_URL` | Public origin of the careers site (`https://…` in production). Used for links and metadata. |
| `POCKETBASE_URL` | PocketBase URL **for the Astro Node server** only. Local dev: `http://127.0.0.1:8090`. **Docker production:** set in [`docker/docker-compose.prod.yml`](docker/docker-compose.prod.yml) to `http://pocketbase:8090` so `.env` can stay dev-oriented. |
| `SITE_HOST` | **Docker production only:** hostname Caddy serves (no `https://`). Must match DNS. |
| `PUBLIC_COMPANY_NAME` | Company name in the site chrome. |
| Other | Resend, signing secret, **submission service** credentials for the Astro server — see `.env.example`. |

Local development example:

```text
PUBLIC_SITE_URL=http://localhost:4321
POCKETBASE_URL=http://127.0.0.1:8090
```

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the full local stack:

```bash
pnpm dev
```

This starts:

- Astro on `http://127.0.0.1:4321`
- PocketBase on `http://127.0.0.1:8090`

The `pnpm dev:pocketbase` script downloads PocketBase automatically on first run if the binary is not already present in `pocketbase/pocketbase`.

Useful scripts:

```bash
pnpm dev
pnpm dev:web
pnpm dev:pocketbase
pnpm build
pnpm preview
pnpm lint
pnpm typecheck
```

## First-Time PocketBase Setup

1. Copy `.env.example` to `.env` and set `POCKETBASE_SUBMISSION_SERVICE_EMAIL` and `POCKETBASE_SUBMISSION_SERVICE_PASSWORD` (use a long random password, at least 10 characters). Optionally set `POCKETBASE_ADMIN_*` for your own reference when logging into the PocketBase Admin UI; **the Astro app does not use the superuser.**
2. Start the app with `pnpm dev` (PocketBase loads the repo `.env` so migrations can seed the `submission_service` user when the password is set).
3. Open PocketBase Admin UI at `http://127.0.0.1:8090/_/`.
4. Create the first superuser when prompted (Admin UI only).
5. If no `submission_service` user exists yet (for example you skipped the password in step 1), create one in **Collections → submission_service → New record** using the same email and password as in `.env`, mark the account verified, then restart `pnpm dev`.

PocketBase applies the migrations in `pocketbase/pb_migrations/` automatically on `serve`.

## Seed the First Job

After creating the PocketBase superuser:

1. Open the `jobs` collection in PocketBase Admin UI.
2. Create a new record.
3. Fill in at least:
   - `slug`
   - `title`
   - `summary`
   - `description`
   - `workModel`
   - `employmentType`
   - `status`
4. Enter `requiredSkills` and `niceToHaveSkills` as one skill per line.
5. If needed, enter `whatToExpect` and `hiringProcess`.
6. Save the job as `draft` while editing.
7. When ready, set `status` to `published`.
8. Set `publishedAt` the first time the job is published.

Once published, the role should appear on `/jobs`.

## PocketBase Notes

- `jobs` is public read-only for published roles.
- `application_notes` remain superuser-only via the Admin UI.
- `applications` and `email_logs` are created only by the **`submission_service`** auth account used by the Astro server (not the superuser).
- Applications are always created through the Astro API route, not directly from the browser.
- PocketBase's built-in plain-text field UI does not expose a configurable large Markdown textarea for `text` fields, so the schema uses clearer field names and help text rather than a custom editor.

## Production Build

Build the web app:

```bash
pnpm build
```

The Astro node adapter outputs the production server entry at:

```text
apps/web/dist/server/entry.mjs
```

## Docker

Files:

- [`docker/Dockerfile.web`](docker/Dockerfile.web) — Node 20, builds Astro, runs `dist/server/entry.mjs`
- [`docker/Dockerfile.pocketbase`](docker/Dockerfile.pocketbase) — PocketBase + migrations
- [`docker/docker-compose.yml`](docker/docker-compose.yml) — **local / dev**: publishes `4321` (web) and `8090` (PocketBase)
- [`docker/docker-compose.prod.yml`](docker/docker-compose.prod.yml) — **production**: Caddy on `80`/`443`, web and PocketBase **not** on public ports; PocketBase also on `127.0.0.1:8090` for SSH tunnel admin access
- [`docker/Caddyfile`](docker/Caddyfile) — reverse proxy + automatic HTTPS when `SITE_HOST` is a real DNS name
- [`docker/caddy-entrypoint.sh`](docker/caddy-entrypoint.sh) — merges an optional PocketBase Admin site when `POCKETBASE_ADMIN_HOST` is set
- [`docker/docker-compose.smoketest.yml`](docker/docker-compose.smoketest.yml) — optional high ports (`18080`/`18443`) for local smoke tests

### Local containers (dev-style ports)

From `docker/`:

```bash
cd docker
docker compose up --build
```

If you use the legacy `docker-compose` v1 binary, the same path works:

```bash
cd docker
docker-compose up --build
```

### Production stack (Caddy + TLS)

From the repository root, with `.env` containing production values and `SITE_HOST` set to your public hostname. **`PUBLIC_SITE_URL` must be the public `https://…` origin** before you run `docker compose ... --build`, so the Astro image records the correct `security.allowedDomains` (otherwise application forms return 403 behind the proxy).

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

After code or `.env` changes, you can rebuild and restart the same stack with **[`scripts/docker-reload.sh`](scripts/docker-reload.sh)** (from repo root: `./scripts/docker-reload.sh` or `./scripts/docker-reload.sh --no-cache` for a clean web build).

Legacy v1 CLI:

```bash
docker-compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

Full AWS steps (EC2, security groups, DNS, backups, optional S3): **[docs/deploy-aws.md](docs/deploy-aws.md)**.

## Production deployment notes

Recommended on-server layout:

```text
/opt/minihire/
  repo/                 # git clone
  .env                  # chmod 600, not in git
  backups/              # optional; see docs/deploy-aws.md
```

Requirements:

- One Astro web service and one PocketBase instance (single SQLite data directory).
- Keep `POCKETBASE_SUBMISSION_SERVICE_EMAIL`, `POCKETBASE_SUBMISSION_SERVICE_PASSWORD`, `RESEND_API_KEY`, and `FORM_SIGNING_SECRET` server-side only (never `PUBLIC_*`). Superuser credentials are for the PocketBase UI only and are not used by the web app.
- Public site on **HTTPS** (Caddy in the prod compose file).
- PocketBase Admin UI: use **SSH tunnel** to `127.0.0.1:8090` (bound on the instance only); do not open `8090` in the security group unless you intentionally expose admin.

## Backup

The backup script is at:

```text
scripts/backup.sh
```

Example:

```bash
./scripts/backup.sh
```

Default paths assume a production layout rooted at `/opt/minihire`. Override them if needed:

```bash
APP_ROOT=/opt/minihire ./scripts/backup.sh
```

The script:

- creates a safe SQLite backup using `sqlite3 .backup`
- copies the PocketBase storage directory
- creates a timestamped archive
- keeps the latest 14 backup files

Backup files use this format:

```text
minihire-backup-YYYY-MM-DD-HH-mm.tar.gz
```

## Restore

To restore a backup:

1. Stop the PocketBase service.
2. Move the current `pb_data` directory aside.
3. Create a fresh `pb_data` directory.
4. Extract the backup archive.
5. Restore `data.db` to `pb_data/data.db`.
6. Restore `storage` to `pb_data/storage`.
7. Start PocketBase again.

Example:

```bash
mkdir -p /opt/minihire/pocketbase/pb_data
tar -xzf minihire-backup-YYYY-MM-DD-HH-mm.tar.gz -C /tmp/restore
cp /tmp/restore/data.db /opt/minihire/pocketbase/pb_data/data.db
cp -R /tmp/restore/storage /opt/minihire/pocketbase/pb_data/storage
```

## Verification

Before shipping changes, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Docker Compose file sanity (requires Docker Compose / `docker-compose` on `PATH`):

```bash
SITE_HOST=127.0.0.1 docker-compose -f docker/docker-compose.prod.yml -f docker/docker-compose.smoketest.yml --env-file .env.example config
```

Local smoke (when the Docker daemon is available): start the prod stack with high ports, then open `http://127.0.0.1:18080/` (see [docs/deploy-aws.md](docs/deploy-aws.md) section 9).

```bash
SITE_HOST=127.0.0.1 docker-compose -f docker/docker-compose.prod.yml -f docker/docker-compose.smoketest.yml --env-file .env up -d --build
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:18080/
docker-compose -f docker/docker-compose.prod.yml -f docker/docker-compose.smoketest.yml down
```
