# PocketBase Hooks

JavaScript hooks in this directory are loaded automatically when PocketBase starts (`serve`). Files must use the **`.pb.js`** extension.

## Current hooks

| File | Purpose |
|------|---------|
| [`applications_portal_updates.pb.js`](./applications_portal_updates.pb.js) | Restricts `applications` **updates** from authenticated **`users`** (portal) to **`status`** and **`starred`** only; superusers are unaffected. All other collections must call `e.next()` so worker updates are not blocked. |

Version 1 may add more hooks (retention, publish timestamps, etc.) without changing the project layout.
