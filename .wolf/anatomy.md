# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-09-16T21:41:49.386Z
> Files: 41 tracked | Anatomy hits: 0 | Misses: 0

> Project structure index. Auto-maintained by OpenWolf hooks and daemon.
> Run `openwolf scan` to generate, or wait for the first Claude Code session.
> Status: Pending initial scan

## ./

- `CLAUDE.md` — OpenWolf (~99 tok)
- `README.md` — Project documentation (~1094 tok)

## skills/artifacts/

- `SKILL.md` — Artifacts (self-hosted) (~1380 tok)

## skills/artifacts/reference/

- `design-tokens.md` — defy.works design tokens (~702 tok)
- `runtime.md` — Page runtime: `window.claude` (~1973 tok)

## skills/artifacts/scripts/

- `artifacts.mjs` — artifacts — CLI for the self-hosted Artifacts platform. (~3698 tok)

## src/app/

- `layout.tsx` — metadata (~215 tok)
- `not-found.tsx` — NotFound (~248 tok)
- `page.tsx` — dynamic (~450 tok)

## src/app/a/[slug]/

- `page.tsx` — dynamic (~539 tok)

## src/app/a/[slug]/edit/

- `page.tsx` — dynamic (~392 tok)

## src/app/login/

- `LoginForm.tsx` — Magic link only (plus Google when configured). No passwords anywhere. (~1302 tok)
- `page.tsx` — metadata (~236 tok)

## src/app/settings/tokens/

- `page.tsx` — metadata (~343 tok)
- `TokensPanel.tsx` — TokensPanel — renders form (~1088 tok)

## src/components/editor/

- `HtmlEditor.tsx` — CAPS (~3141 tok)

## src/components/gallery/

- `Gallery.tsx` — Card — renders form, modal (~1515 tok)
- `starter.ts` — Starter page for artifacts created in the browser: shows the runtime working. (~827 tok)

## src/components/shell/

- `Header.tsx` — Editorial top chrome, same grammar as defy.works: wordmark left, indexed (~1100 tok)

## src/components/ui/

- `Badge.tsx` — BASE (~326 tok)
- `Button.tsx` — BASE (~436 tok)
- `Dialog.tsx` — Block dismissal by backdrop / escape (consent prompts). (~410 tok)
- `Input.tsx` — INPUT_BASE_CLASS (~379 tok)
- `Label.tsx` — Editorial stamp label — mono, tracked, uppercase, indigo-tinted. (~114 tok)
- `Spinner.tsx` — Spinner (~95 tok)

## src/components/viewer/

- `ArtifactViewer.tsx` — ArtifactViewer — renders modal (~2179 tok)
- `CommentsPanel.tsx` — CommentsPanel (~1575 tok)
- `ShareDialog.tsx` — LINK_OPTIONS — renders form, modal (~1550 tok)
- `SidePanel.tsx` — SidePanel (~236 tok)
- `VersionsPanel.tsx` — VersionsPanel (~845 tok)
- `ViewerChrome.tsx` — ViewerChrome (~963 tok)

## src/lib/

- `auth-client.ts` — Exports authClient (~94 tok)
- `auth.ts` — Exports auth, hasGoogle, hasEmail, Session (~704 tok)
- `email.ts` — Transactional email through Sendsprite (defy.works' own SES-backed API). (~1639 tok)
- `format.ts` — Exports timeAgo, bytes, capabilityList (~242 tok)
- `serve-html.ts` — Prepare a published page for the viewer frame: inject the runtime as (~384 tok)

## src/lib/bridge/

- `api.ts` — Exports ClientApiError, api, artifactUrl (~453 tok)
- `host.ts` — Host side of the artifact runtime. Receives `use`/`call`/`subscribe` (~7447 tok)
- `realtime-client.ts` — One EventSource per open artifact, shared by the viewer chrome and the (~604 tok)

## src/providers/

- `Providers.tsx` — Providers (~165 tok)

## src/styles/

- `globals.css` — Styles: 19 rules, 37 vars (~1496 tok)
