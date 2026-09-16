# @defyworks/artifacts

CLI for the self-hosted [defy.works Artifacts](https://artifacts.defy.works) platform, packaged with its Claude Code skill. Publish interactive HTML pages from the terminal or from Claude Code, share them by email or link, and read or seed the live database behind each page.

```bash
bunx @defyworks/artifacts login --token art_…            # --url only for a self-hosted instance
bunx @defyworks/artifacts publish page.html --slug retro --capabilities '{"db":{},"room":{}}' --link interact
bunx @defyworks/artifacts help
```

Tokens are created at https://artifacts.defy.works/settings/tokens. Config lives in `~/.config/artifacts/config.json`; `ARTIFACTS_TOKEN` and `ARTIFACTS_URL` override it. The URL defaults to `https://artifacts.defy.works`.

## As a Claude Code skill

The package contains `SKILL.md` and the runtime reference. Install it as a skill straight from the repo:

```bash
bunx skills add defy-works/artifacts --skill artifacts -g -a claude-code
```

Source and platform: https://github.com/defy-works/artifacts (MIT).
