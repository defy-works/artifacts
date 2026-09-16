---
description: learned preferences, project conventions, and Do-Not-Repeat rules
budget_tokens: 2000
---
# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-09-16

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

- Greenfield stack: Drizzle ORM + Postgres (user switched away from Convex mid-build on 2026-09-17). Keep a single Postgres as the only datastore.
- Reuse defy.works site_v2 design tokens (`@theme` in globals.css, Space Grotesk/SUIT, indigo on ink, glass, hairlines, num-stamp labels).
- Deploys go to Coolify via Docker Compose; changes to Coolify through its API, not the UI. Pushing to `main` auto-deploys through the GitHub webhook — do NOT call `POST /deploy` yourself.
- Transactional email goes through Sendsprite (the user's own SES-backed email API at ~/Documents/Work/Mail, npm `sendsprite`), never Resend/Postmark. Tags are a string map, not an array.

## Key Learnings

- **Project:** Artifacts

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

- [2026-09-17] Do not put route folders under `src/app/_name` — App Router treats `_`-prefixed folders as private. Use a plain folder and a rewrite in next.config.ts.
- [2026-09-17] Never compute `srcdoc`/origin-dependent props during render in a client component; React refuses to patch attribute mismatches after hydration. Resolve `window.location.origin` in a `useEffect`.
- [2026-09-17] Next route files may only export handlers/config; a stray `export const` breaks `next build`.
- [2026-09-17] In zsh, `A="node script"; $A cmd` does not word-split. Use a shell function.
- [2026-09-17] NEVER `kill $(lsof -t -i:PORT)` — it matches client connections too and killed the user's browser. Only the listener: `lsof -t -iTCP:PORT -sTCP:LISTEN`.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->

- 2026-09-17 Realtime via Postgres LISTEN/NOTIFY + SSE (not websockets): keeps one process type, works behind Traefik, payloads are invalidations (ids/paths) so the 8 KB NOTIFY cap never matters.
- 2026-09-17 Blobs (HTML versions, files, assets) stored as Postgres bytea instead of a volume/S3: one datastore, simplest Coolify deploy; revisit if assets grow past a few GB.
- 2026-09-17 Artifact frame is a sandboxed `srcdoc` iframe without `allow-same-origin`; host validates `event.source`, never an origin. Consequence: pages have no localStorage (documented in the skill).
- 2026-09-17 One API surface (`/api/v1`) for browser (cookie) and skill (Bearer token) so behaviour never diverges.
