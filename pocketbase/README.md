# PocketBase Directory

This directory contains the PocketBase-specific assets for minihire.

## Contents

- `pb_migrations/`: schema migrations for collections, fields, rules, and indexes
- `pb_hooks/`: PocketBase JS hooks (e.g. portal update guards)

## Local Usage

From the repository root:

```bash
pnpm dev:pocketbase
```

On first run, the helper script downloads the PocketBase binary into this directory.

PocketBase data is stored in:

```text
pocketbase/pb_data
```

## Admin UI

The admin UI is available locally at:

```text
http://127.0.0.1:8090/_/
```

Create the first superuser there. The Astro app authenticates to PocketBase as the **`submission_service`** account (see root `.env.example`); it does **not** use the superuser.

### Recruiter portal (`users` auth)

PocketBase ships a default **`users`** auth collection. Minihire extends it (see `pb_migrations/1747066000_recruiter_portal_users_rules.js`) with `role` (`admin` \| `recruiter`) and `active` for recruiter portal login (**Model A** in [`tmp/minihire-ai-docs-with-recruiter-portal/minihire-ai-docs/recruiter-portal-locked-decisions.md`](../tmp/minihire-ai-docs-with-recruiter-portal/minihire-ai-docs/recruiter-portal-locked-decisions.md)). Create recruiter accounts in the Admin UI under **Collections → users** (or `superuser upsert` is only for `_superusers`, not `users` — use Admin UI **Auth → users** or the users API after first superuser exists).

Hooks under [`pb_hooks/`](./pb_hooks/) enforce that portal users cannot overwrite arbitrary `applications` fields (status-only updates).

Migration `1747066100_jobs_admin_portal_update` sets **`jobs.updateRule`** so PocketBase **`users`** with **`role = admin`** (and `active`) may update job records from the Astro recruiter portal; **`recruiter`** role and **`submission_service`** do not receive update access via rules.

Migration `1747066600_ai_evaluation_collections` adds AI collections (`application_normalizations`, `application_ai_validations`, `application_github_evidence`, `application_ai_runs`, `application_ai_evaluation_reports`). Recruiters may **read** and **create** runs (`started_by` must match); **`submission_service`** creates/updates pipeline artifacts and run status.

Migration `1747067600_jobs_submission_service_read` grants **`submission_service`** read access to **`jobs`** in any status so the AI worker can load job context for existing applications (including draft/archived roles).

### Docker / production data directory

When PocketBase runs with **`--dir=/pb_data`** (as in the production container), every CLI command that mutates data must use the same **`--dir`**, for example:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env exec pocketbase \
  ./pocketbase superuser upsert admin@example.com 'your-strong-password' --dir=/pb_data
```

Without `--dir=/pb_data`, the CLI may update a different on-disk database than the running server.
