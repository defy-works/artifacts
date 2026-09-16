# @defy-works/artifacts

CLI for the self-hosted [defy.works Artifacts](https://artifacts.defy.works) platform, packaged with its Claude Code skill. Publish interactive HTML pages from the terminal or from Claude Code, share them by email or link, and read or seed the live database behind each page.

```bash
bunx @defy-works/artifacts login --url https://artifacts.defy.works --token art_…
bunx @defy-works/artifacts publish page.html --slug retro --capabilities '{"db":{},"room":{}}' --link interact
bunx @defy-works/artifacts help
```

Tokens are created at `<site>/settings/tokens`. Config lives in `~/.config/artifacts/config.json` or `ARTIFACTS_URL` / `ARTIFACTS_TOKEN`.

## As a Claude Code skill

The package contains `SKILL.md` and the runtime reference. Install it as a skill straight from the repo:

```bash
bunx skills add defy-works/artifacts --skill artifacts -g -a claude-code
```

Source and platform: https://github.com/defy-works/artifacts (MIT).
