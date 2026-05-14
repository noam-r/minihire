# PocketBase Hooks

JavaScript hooks in this directory are loaded automatically when PocketBase starts (`serve`). Files must use the **`.pb.js`** extension.

## Current hooks

| File | Purpose |
|------|---------|
| [`applications_portal_updates.pb.js`](./applications_portal_updates.pb.js) | Restricts `applications` **updates** from authenticated **`users`** (portal) to **`status`** only; superusers are unaffected. |

Version 1 may add more hooks (retention, publish timestamps, etc.) without changing the project layout.
