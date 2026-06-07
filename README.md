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
- `sqlite3` on the host when using **host-path** backups (`scripts/backup.sh` without `POCKETBASE_DOCKER_CONTAINER`); optional if you only use **Docker container** backups
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

The recruiter portal is at **`http://127.0.0.1:4321/recruiter`** after you create a PocketBase `users` account with `role` and `active` (see **Recruiter portal** below).

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

## Recruiter portal

Hiring staff use the **recruiter portal** at **`/recruiter`** on the same origin as `PUBLIC_SITE_URL` (for example `http://127.0.0.1:4321/recruiter` in local dev). It authenticates against PocketBase’s default **`users`** auth collection after migration `1747066000_recruiter_portal_users_rules` adds **`role`** (`admin` or `recruiter`) and **`active`**.

1. In PocketBase Admin, open the **`users`** auth collection.
2. Create a record (or edit an existing test user): set **`role`**, turn **`active`** on, and set a password under the auth UI.
3. Sign in at `/recruiter`.

From the portal you can review applications (paginated list), open a candidate (status changes, internal notes, CV download through the app), and **admins** can edit jobs (title, slug, summary, description, status, optional published date) on each job’s recruiter page after migration `1747066100_jobs_admin_portal_update`. **`email_logs`** are not shown in the portal (v1). Recruiters without the **admin** role see jobs read-only in the portal; job **creation** and **deletion** remain in PocketBase Admin (superuser or future rules).

### AI-assisted evaluation (optional)

Migration `1747066600_ai_evaluation_collections` adds PocketBase collections for CV normalization, LLM validation, evaluation reports, and async run tracking. Design docs: [`tmp/minihire-ai-docs/`](tmp/minihire-ai-docs/).

1. Set in `.env` (see [`.env.example`](.env.example)): `AI_ENABLED=true`, `AI_PROVIDER` (`openai` or `anthropic`), `AI_API_KEY`, `AI_MODEL`, and optionally `AI_CLI_STARTED_BY_USER_ID` for CLI audit.
2. On an application detail page, use **Run AI evaluation** in the Review sidebar (queues a run; does not block the browser).
3. Run the worker so queued runs complete (uses `submission_service`, same as the apply API):

   ```bash
   pnpm ai:worker -- --once          # one batch
   ./scripts/run-ai-worker.sh        # same, for cron/systemd
   ```

   In production, schedule `run-ai-worker.sh` every 1–2 minutes (cron or a supervisor). The `web` container must reach your LLM provider API over HTTPS.

4. CLI (ops / debugging): `pnpm ai:normalize`, `pnpm ai:validate`, `pnpm ai:evaluate -- --application <id> --started-by <users-id>`, `pnpm enqueue-ai-evaluations -- --dry-run` (queue all unevaluated applications for the worker).

Recruiters see scores and evidence on the application page; full tables live at `/recruiter/applications/<id>/ai`. GitHub evidence (Phase 3) is not implemented yet.

### Candidate clarification (follow-up questions)

Migration `1747067300_clarification_flow` adds `clarification_requests`, `clarification_items`, and summary fields on `applications`.

1. On an application detail page, use **Clarify** (or **Review and send** when AI suggested questions exist) to open `/recruiter/applications/<id>/clarify`, edit questions, and send.
2. The candidate receives an email with a secure link to `/candidate/clarification/<token>` (expires after 14 days).
3. Set `MINIHIRE_SYSTEM_ALERTS_EMAIL` in `.env` (server-only) to receive an internal email when the candidate submits answers. If unset in development, answers are still saved and a warning is logged.

Spec: [`tmp/minihire-clarification-flow-spec.md`](tmp/minihire-clarification-flow-spec.md).

## PocketBase Notes

- `jobs` is public **list/view** for **published** roles only. Authenticated portal users (`users` with `role` + `active`) and **`submission_service`** (AI worker / apply API) can list and view jobs in any status per migration rules (`1747067600_jobs_submission_service_read`).
- `application_notes` are readable and creatable from the recruiter portal; each note’s **`author`** must match the signed-in user (enforced by PocketBase rules).
- `applications` and `email_logs` are created by the **`submission_service`** auth account used by the Astro server (not the superuser). Portal users may update **`applications.status`** and **`applications.starred`** only (see `pocketbase/pb_hooks/applications_portal_updates.pb.js`).
- Applications from candidates are always created through the Astro API route, not directly from the browser.
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

- [`docker/Dockerfile.web`](docker/Dockerfile.web) — Node 20, builds Astro, runs `dist/server/entry.mjs`. **Build args** are limited to non-secrets (`PUBLIC_*`, optional `MAX_CV_SIZE_BYTES`). `POCKETBASE_URL`, API keys, `FORM_SIGNING_SECRET`, and the submission-service password are **not** passed at image build time; the running container loads them from `env_file` / `environment` in Compose so they are not baked into image layers.
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

- creates a safe SQLite backup using `sqlite3 .backup` (host `sqlite3` for bind-mounted data; container `sqlite3` when using `POCKETBASE_DOCKER_CONTAINER`)
- copies the PocketBase storage directory
- creates a timestamped archive
- keeps the latest 14 backup files

**Docker production:** data lives in the `pocketbase` container under `/pb_data`, not on the host path above. Either bind-mount `pb_data` and set `POCKETBASE_DATA_DIR`, or run with a container name (requires a PocketBase image that includes `sqlite3` — see `docker/Dockerfile.pocketbase`):

```bash
export POCKETBASE_DOCKER_CONTAINER=minihire-pocketbase
export BACKUP_DIR=/opt/minihire/backups   # optional; defaults under APP_ROOT
./scripts/backup.sh
```

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
