---
name: artifacts
description: Publish, update, share and inspect interactive HTML pages on the self-hosted defy.works Artifacts platform (a Claude Code Artifacts clone with a live database, presence, assets and downloads built in). Use when the user asks to publish a page, dashboard, report, tool, board, poll, tracker or prototype as a shareable URL; to update, share or delete a published artifact; to seed or read its database; or to read comments people left on it.
---

# Artifacts (self-hosted)

The platform serves an HTML page inside a sandboxed frame and injects `window.claude.use(name)` so the page can reach a live document store (`db`), presence and events (`room`), republishing (`artifact`), file uploads (`assets`), file saves (`downloads`), the viewer (`user`) and `permissions`. Sharing is per email (view / interact / edit) or by link.

Everything goes through `scripts/artifacts.mjs` (Node 18+, no dependencies). Run it with an absolute path to this skill's folder.

## Setup (once per machine)

1. The user creates a token at `<site>/settings/tokens`.
2. Save it: `node <skill>/scripts/artifacts.mjs login --url https://artifacts.example.com --token art_…`
   (or export `ARTIFACTS_URL` and `ARTIFACTS_TOKEN`). Config lives in `~/.config/artifacts/config.json`.
3. `node <skill>/scripts/artifacts.mjs me` confirms it works.

If `me` fails with `unauthorized`, ask the user for a token; do not guess.

## Publishing workflow

1. Write the complete page to a file in the scratchpad (`<!doctype html>` first; a single self-contained HTML file; external scripts only from cdnjs.cloudflare.com or cdn.jsdelivr.net; give it a `<title>` of two to four words).
2. Decide the capabilities the page needs and pass them exactly as the page uses them. Common shapes:
   - `{"db":{}}` shared data; `{"db":{"rules":[{"path":"","read":"view","write":"admin"}]}}` read-mostly.
   - `{"room":{}}` presence + admin-only events; `{"room":{"topics":{"reaction":"interact"}}}` opens a topic.
   - `{"artifact":{}}` the page republishes itself; `{"assets":{}}` uploads; `{"downloads":{}}` file saves.
3. Publish:
   ```bash
   node <skill>/scripts/artifacts.mjs publish page.html --slug weekly-retro --title "Weekly Retro" \
     --favicon "🗒️" --capabilities '{"db":{},"room":{}}' --link interact
   ```
   The command prints the URL. Re-running `publish` with the same `--slug` creates a new version (history is kept; other viewers reload live).
4. Give the user the URL. Default link access is `none` (invited emails only); pass `--link view|interact|edit` when the user wants a link anyone can open, or share by email:
   ```bash
   node <skill>/scripts/artifacts.mjs share weekly-retro --add teammate@company.com:edit --link view
   ```

Levels: **view** reads the page and shared data; **interact** also writes shared data and opens room topics; **edit** also publishes versions, files and assets; the **owner** does everything and manages sharing.

## Page runtime

Read `reference/runtime.md` before writing any page that calls `claude.use(...)`. The essentials:

- `const db = await claude.use("db"); if (!db) renderWithoutDb();` — every `use()` may resolve `null`; render first, light features up when it resolves.
- Document paths have an even number of segments (`tasks/t1`), collections odd (`tasks`). Bodies are plain JSON objects ≤ 256 KiB. `set` replaces, `update` merges and requires existence, `onSnapshot` subscribes once (never inside render).
- Per-viewer private data goes under `data/users/<id>/…` with `id` from `await (await claude.use("user")).id()`.
- `room.presence({...})` for cursors and picks, `room.emit(topic, data)` for moments, `db` for anything a late joiner must see.
- Pages in the sandbox cannot use `localStorage`; use `db` (or `data/users/<id>/`) instead.

## Other commands

```bash
artifacts list                                   # your artifacts and ones shared with you
artifacts get <slug> [--html out.html]           # metadata, level, files; optionally save the live HTML
artifacts delete <slug>
artifacts versions <slug> | artifacts restore <slug> <versionId>
artifacts db <slug> get tasks/t1
artifacts db <slug> query tasks --where done == true --order createdAt desc --limit 50
artifacts db <slug> set tasks/t1 '{"title":"Ship","done":false}'      # or @file.json
artifacts db <slug> update tasks/t1 '{"done":true}' | delete tasks/t1 | batch @ops.json
artifacts comments <slug> | artifacts comment <slug> "Reply text" --reply <commentId> | artifacts resolve <slug> <id>
artifacts upload <slug> ./chart.png              # asset → prints id and /_blob/<id> URL
artifacts files <slug> | artifacts file put <slug> data/rows.json ./rows.json | artifacts file rm <slug> data/rows.json
```

Seed data with `db set`/`batch` rather than hardcoding sample rows in the page. Read comments when the user asks what feedback a page got, and answer in the thread with `comment --reply`.

## Design

The platform chrome uses the defy.works tokens (black ink, indigo accent, Space Grotesk). Pages are free to use their own look, but for anything presented as a defy.works deliverable use the tokens in `reference/design-tokens.md`. Always support light and dark (`prefers-color-scheme`) and phone width with a 16px gutter.
