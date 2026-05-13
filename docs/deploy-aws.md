# Deploy on AWS (EC2 + Docker Compose + Caddy)

This guide matches the production stack in [`docker/docker-compose.prod.yml`](../docker/docker-compose.prod.yml): **PocketBase** and **Astro** stay on an internal Docker network; **Caddy** terminates TLS and reverse-proxies to the web app.

PocketBase uses **SQLite + local files** under `pb_data`. Run **one** long-lived instance with durable disk (EBS), not ephemeral-only compute.

## Architecture

- **Internet → EC2 security group** allows `80` and `443` (and optionally `22` or use SSM only).
- **Caddy** listens on `80`/`443`, obtains certificates (Let’s Encrypt HTTP-01) when `SITE_HOST` is a public DNS name.
- **Astro** calls PocketBase at `http://pocketbase:8090` inside the compose network (`POCKETBASE_URL` in the web container).
- **Candidates** see only `PUBLIC_SITE_URL` (must be the public `https://…` origin).

## 1. EC2 instance

- **AMI:** Amazon Linux 2023 or Ubuntu 22.04 LTS.
- **Size:** `t3.small` or `t3.medium` to start.
- **Disk:** root gp3 **≥ 30 GiB**; optionally add a second gp3 volume mounted at `/var/lib/minihire` for data and bind-mount later (optional; named Docker volume on root disk is fine for small teams).
- **Elastic IP:** allocate and associate so DNS and TLS stay stable.

Install Docker Engine and the Compose plugin (recommended), or the standalone `docker-compose` v1 binary:

Amazon Linux 2023 example (Compose v2 plugin):

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# log out and back in
sudo dnf install -y docker-compose-plugin
```

## 2. Security groups

| Direction | Port | Source | Purpose |
|-----------|------|--------|---------|
| Inbound | 443 | 0.0.0.0/0 | HTTPS (Caddy) |
| Inbound | 80 | 0.0.0.0/0 | HTTP → ACME + redirect |
| Inbound | 22 | Your admin IP | SSH (prefer replacing with SSM Session Manager and removing 22) |
| Inbound | 8090 | **omit** | PocketBase admin not exposed publicly (recommended) |

Access PocketBase Admin UI via **SSH local forward** (example):

```bash
ssh -i key.pem -L 8090:127.0.0.1:8090 ec2-user@<elastic-ip>
# then open http://127.0.0.1:8090/_/ on your laptop
```

For that to work, the prod compose file must **not** publish `8090` on `0.0.0.0` (current [`docker/docker-compose.prod.yml`](../docker/docker-compose.prod.yml) already keeps PocketBase internal-only).

## 3. DNS (Route 53)

- Create a public hosted zone (or use an existing zone).
- **A record** (or AAAA): `careers.example.com` → Elastic IP of the instance.
- Wait for propagation before relying on Let’s Encrypt.

## 4. Application directory

Suggested layout on the server:

```text
/opt/minihire/
  repo/                 # git clone of this project
  .env                  # not committed; chmod 600
```

Clone the repository and copy env:

```bash
sudo mkdir -p /opt/minihire
sudo chown ec2-user:ec2-user /opt/minihire
cd /opt/minihire
git clone <your-repo-url> repo
cd repo
cp .env.example .env
chmod 600 .env
```

Edit `.env` on the server (use SSM Parameter Store or Secrets Manager in real ops; below is minimal):

| Variable | Production value |
|----------|-------------------|
| `PUBLIC_SITE_URL` | `https://careers.example.com` |
| `PUBLIC_COMPANY_NAME` | Your company display name |
| `POCKETBASE_URL` | Ignored for SSR in Docker prod (compose sets `http://pocketbase:8090`). Keep `http://127.0.0.1:8090` in `.env` if you also use `pnpm dev` on a workstation. |
| `POCKETBASE_SUBMISSION_SERVICE_EMAIL` / `POCKETBASE_SUBMISSION_SERVICE_PASSWORD` | Dedicated PocketBase auth for the web app (≥10 chars). Same values must be available to the **pocketbase** container on first boot if you rely on migration auto-seeding. |
| `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` | Superuser for the PocketBase `/_/` UI only (optional in `.env` for your notes; **not** used by Astro). |
| `RESEND_API_KEY` | Production key |
| `FORM_SIGNING_SECRET` | Long random string |
| `APPLICATION_EMAIL_FROM` / `APPLICATION_EMAIL_REPLY_TO` | Valid sender domain |

Set **Caddy** host (same hostname as in DNS):

```bash
# append to .env or export before compose
SITE_HOST=careers.example.com
```

## 5. Start the stack

From the **repository root** on the server:

```bash
cd /opt/minihire/repo
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

With the legacy `docker-compose` v1 CLI:

```bash
cd /opt/minihire/repo
docker-compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

- Public site: `https://$SITE_HOST`
- PocketBase: not on the public internet; use SSH tunnel for `/_/`.

## 6. First-time PocketBase

1. SSH tunnel to `8090` as above.
2. Open `http://127.0.0.1:8090/_/`, create the superuser if prompted (admin UI only).
3. Ensure `.env` defines `POCKETBASE_SUBMISSION_SERVICE_EMAIL` and `POCKETBASE_SUBMISSION_SERVICE_PASSWORD` (long random password). The **pocketbase** service uses the same `env_file` as `web` so the migration can create the `submission_service` account on first start when the password meets the length requirement.
4. If the service user was not created automatically, add it under **Collections → submission_service** with the same email and password as in `.env`, mark it verified, then restart the stack.

## 7. Backups

[`scripts/backup.sh`](../scripts/backup.sh) expects `sqlite3` and a **host path** to `pb_data`. With Docker **named volumes**, copy data out then run the script, or archive the volume directly.

**Option A — archive named volume (simple):**

```bash
cd /opt/minihire/repo
docker compose -f docker/docker-compose.prod.yml --env-file .env exec -T pocketbase \
  tar czf - -C /pb_data . > "/tmp/pb-backup-$(date +%Y%m%d%H%M).tar.gz"
```

(`docker-compose ...` works the same with the v1 binary.)

Copy `/tmp/pb-backup-*.tar.gz` to S3 (see below).

**Option B — host path + existing script:** mount a host directory over `/pb_data` for the `pocketbase` service (custom override on the server), then set:

```bash
export POCKETBASE_DATA_DIR=/var/lib/minihire/pb_data
./scripts/backup.sh
```

### Optional: upload backups to S3

```bash
aws s3 cp "/tmp/pb-backup-$(date +%Y%m%d%H%M).tar.gz" s3://your-bucket/minihire/
```

Add an S3 lifecycle rule to expire old objects after N days.

## 8. Restore

Stop the stack, restore files into the PocketBase data directory (or volume), then start again. See the Restore section in [README.md](../README.md).

## 9. Local smoke test (optional)

When port **80** is already in use on your laptop, use the high-port override:

```bash
docker-compose -f docker/docker-compose.prod.yml -f docker/docker-compose.smoketest.yml --env-file .env up -d --build
```

Set `SITE_HOST=127.0.0.1` (or export it for the command) and open `http://127.0.0.1:18080/`.

Validate compose files without starting containers:

```bash
SITE_HOST=127.0.0.1 docker-compose -f docker/docker-compose.prod.yml -f docker/docker-compose.smoketest.yml --env-file .env.example config
```

## 10. Secrets hygiene

- Do not commit `.env`.
- Prefer **AWS Systems Manager Parameter Store** (`SecureString`) or **Secrets Manager** and a small entrypoint script to materialize `.env` at boot, or use `environment` from SSM in a wrapper (advanced).
- Store **`POCKETBASE_SUBMISSION_SERVICE_PASSWORD`** with the same care as database credentials; it can create application rows and read those collections within API rule limits, but it is not a superuser.

## Out of scope here

- **ECS/Fargate** as the primary pattern (SQLite + file storage is a poor fit without redesign).
- **ALB + ACM** — possible later; this stack uses **Caddy** for TLS on the instance instead.
