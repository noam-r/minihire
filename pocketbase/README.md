# PocketBase Directory

This directory contains the PocketBase-specific assets for minihire.

## Contents

- `pb_migrations/`: schema migrations for collections, fields, rules, and indexes
- `pb_hooks/`: optional future PocketBase hooks

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
