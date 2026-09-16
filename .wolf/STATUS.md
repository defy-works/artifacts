---
description: session handoff, regenerate with /handoff when a quest finishes
budget_tokens: 1000
---
# STATUS — Artifacts

> Read this FIRST when starting a session. Last updated: 2026-09-17

---

## ✅ Done

- **Platform (v0.1):** Next.js 15 + Drizzle/Postgres + better-auth. Gallery, viewer (sandboxed srcdoc iframe + injected `public/claude-runtime.js`), in-browser HTML editor, share dialog (email roles + link access), versions panel with restore, comments panel, API tokens page. defy.works tokens in `src/styles/globals.css`.
- **Runtime capabilities:** db (paths, rules, `{self}`, leases, live via SSE invalidation), room (presence heartbeat + events), artifact.publish (html + files form), assets (`/_blob/<id>`), downloads (confirm dialog), permissions, user. `sample` (ask Claude) was removed on 2026-09-17 at the user's request: no Anthropic key needed.
- **Auth:** magic link only (better-auth `magicLink`, 10 min, single-use) plus Google when configured; passwords disabled on 2026-09-17. Mail goes through Sendsprite (`src/lib/email.ts`); share invites too. Without a key, mails are logged to the server console.
- **API:** `/api/v1/*` accepts session cookie or Bearer token. SSE at `/api/v1/artifacts/:slug/events`.
- **Skill:** `skills/artifacts` (SKILL.md, `scripts/artifacts.mjs` CLI, `reference/runtime.md`, `reference/design-tokens.md`). Install: `bunx skills add defy-works/artifacts --skill artifacts -g -a claude-code` (copies into ~/.claude/skills/artifacts; re-run to update).
- **Verified:** curl e2e (`scratchpad/e2e.sh`), Playwright browser test (owner + anonymous live sync, runtime probe), every CLI command. `tsc` clean.

---

- **Deployed 2026-09-17** to Coolify at https://artifacts.defy.works from `github.com/defy-works/artifacts` `main` (compose buildpack). Pushes auto-deploy via webhook. Coolify identifiers live in `.wolf/deploy.local.md` (untracked).

## 🚀 Next phase

**Goal:** use it from Claude Code for real.

### Acceptance criteria
1. Sign in at https://artifacts.defy.works/login, create a token, `artifacts login --url https://artifacts.defy.works --token …`, publish a page and open it.

### Open decisions
- Google OAuth on or off for this deployment.
- Whether assets/files should move to object storage later (currently Postgres bytea).

---

## 📁 Active architecture

- **Stack:** Next.js 15 App Router, React 19, Tailwind v4, Drizzle + postgres.js, better-auth (+ magic-link plugin), sendsprite SDK, sonner. Bun for scripts, Node ≥18 for the skill CLI.
- **Key modules:** `src/db/schema.ts`; `src/lib/{access,rules,paths,filters,realtime,serve-html}.ts`; `src/lib/services/*`; `src/lib/bridge/{host,realtime-client,api}.ts`; `public/claude-runtime.js`; `src/app/api/v1/**`.
- **Patterns:** route handlers wrap with `handler()` from `src/lib/http.ts` and throw `ApiError`; every write publishes an `RtEvent`; artifact visibility failures 404 (never 403) so existence is not leaked; underscore public paths (`/_blob`, `/_files`) are rewrites in `next.config.ts`.

---

## ⚠️ External blockers

- Dev server runs on port 3001 locally (3000 is taken by another process); `.env.local` points at 3001.
- Local Postgres: docker container `artifacts-pg` on 55432.

---

## 🔧 Useful commands

```bash
bun run dev                       # PORT=3001 locally
bun run db:generate && bun run db:migrate
bunx tsc --noEmit && bunx next lint
node skills/artifacts/scripts/artifacts.mjs help
```
