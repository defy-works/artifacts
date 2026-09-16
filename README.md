# Artifacts

Self-hosted Claude Code Artifacts: publish an HTML page from Claude Code, get a shareable URL, and let the page use a live database, presence, uploads and downloads through `window.claude.use(...)`. Styled with the defy.works design tokens.

## Stack

- Next.js 15 (App Router) + React 19, Tailwind v4 with the `site_v2` `@theme` tokens and self-hosted Space Grotesk / SUIT.
- Postgres via Drizzle ORM — the only datastore (metadata, documents, presence, comments, and the HTML / file / asset blobs).
- better-auth: magic-link sign-in through Sendsprite (no passwords), Google when configured; cookie sessions.
- Realtime: Postgres `LISTEN/NOTIFY` fanned out over Server-Sent Events per artifact.
- Pages render in a sandboxed `srcdoc` iframe (opaque origin); `public/claude-runtime.js` is injected first and talks to the host over `postMessage`.

## Run locally

```bash
cp .env.local.example .env.local            # fill DATABASE_URL, BETTER_AUTH_SECRET
docker run -d --name artifacts-pg -e POSTGRES_PASSWORD=artifacts -e POSTGRES_USER=artifacts \
  -e POSTGRES_DB=artifacts -p 55432:5432 postgres:16-alpine
bun install
bun run db:migrate
bun run dev                                  # http://localhost:3000
```

Request a sign-in link at `/login` (without a Sendsprite key it is printed in the server log), create a token at `/settings/tokens`, then configure the skill (below).

## Deploy (Coolify, Docker Compose)

`docker-compose.yml` runs the app plus Postgres 16 with a persistent volume; the container applies migrations on start. Set these in Coolify:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public origin, e.g. `https://artifacts.defy.works` (build arg and runtime) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | Database password used by both services |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google sign-in (callback `<site>/api/auth/callback/google`) |
| `ALLOWED_EMAILS` | Optional comma-separated sign-up allowlist |
| `SENDSPRITE_API_KEY` | Sendsprite key (`ss_live_…`) for magic links and share invites; unset = emails are logged to the console |
| `SENDSPRITE_URL` | Only for a self-hosted Sendsprite instance |
| `EMAIL_FROM` | Sender on a domain verified in Sendsprite, e.g. `Artifacts <artifacts@defy.works>` |

SSE needs proxy buffering off; the stream sets `X-Accel-Buffering: no` and Traefik passes it through unchanged.

## Claude Code skill

`skills/artifacts` is an Agent Skill and an npm package (`@defyworks/artifacts`). Install the skill with the `skills` CLI, or run the CLI straight from npm:

```bash
bunx skills add defy-works/artifacts --skill artifacts -g -a claude-code   # skill for Claude Code
bunx @defyworks/artifacts help                                          # CLI only
```

(`--skill artifacts` matters: the repo also carries its own project-only `openwolf` skill under `.claude/skills/`, which the CLI would otherwise install too.)

It wraps the token-authenticated API with a dependency-free Node CLI:

```bash
node ~/.claude/skills/artifacts/scripts/artifacts.mjs login --url https://artifacts.defy.works --token art_…
node ~/.claude/skills/artifacts/scripts/artifacts.mjs publish page.html --slug retro --capabilities '{"db":{},"room":{}}' --link interact
```

See `skills/artifacts/SKILL.md` and `skills/artifacts/reference/runtime.md` for the full command set and the page runtime contract.

## Sharing model

| Level | Can |
| --- | --- |
| view | open the page, read shared documents, comment |
| interact | also write shared documents, send opened room topics |
| edit | also publish versions, files and assets, restore versions |
| owner | everything plus sharing and deletion |

Access is the higher of an email share and the artifact's link access (`none` by default). Per-viewer data under `data/users/<id>/` is private to that viewer.

## API

Everything the UI does is available under `/api/v1` with either the session cookie or `Authorization: Bearer <token>`:

- `GET /me` · `GET|POST /artifacts` · `GET|PUT|DELETE /artifacts/:slug`
- `GET /artifacts/:slug/versions` · `GET /versions/:id` · `POST /versions/:id/restore`
- `GET|PUT /artifacts/:slug/share`
- `POST /artifacts/:slug/db` `{op: get|query|set|update|delete|acquire|batch}`
- `POST /artifacts/:slug/room` `{op: heartbeat|leave|emit|peers}` · `GET /artifacts/:slug/events` (SSE)
- `GET|POST /artifacts/:slug/assets` · `DELETE /assets/:id` · served at `/_blob/:id`
- `GET /artifacts/:slug/files` · `GET|PUT|DELETE /files/*path` · served at `/_files/:artifactId/*path`
- `GET|POST /artifacts/:slug/comments` · `PATCH|DELETE /comments/:id`
- `GET|POST /tokens` · `DELETE /tokens/:id` (session only)

## Limits

HTML ≤ 16 MiB per version; files ≤ 16 MiB each, 255 per artifact; assets ≤ 20 MiB (SVG 2 MiB), 500 files / 512 MiB per artifact; documents ≤ 256 KiB, 5,000 per artifact; room payloads ≤ 4 KiB.

## License

MIT © 2026 defy.works. See `LICENSE`.
