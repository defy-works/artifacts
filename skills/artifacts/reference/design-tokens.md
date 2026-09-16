# defy.works design tokens

Copied from `Defyworks/site_v2/src/styles/globals.css`, plus the data-surface additions from `aws-cost-dashboard`. Use these when a page should read as a defy.works deliverable; drop them in a `:root` block and reference the variables.

```css
:root {
  /* Colors — ink + indigo scale */
  --color-ink: #000000;
  --color-shadow: #0a0a0a;
  --color-indigo-50: #eef2ff;  --color-indigo-100: #e0e7ff; --color-indigo-200: #c7d2fe;
  --color-indigo-300: #a5b4fc; --color-indigo-400: #818cf8; --color-indigo-500: #6366f1;
  --color-indigo-600: #4f46e5; --color-indigo-700: #4338ca; --color-indigo-800: #312e81;
  --color-indigo-900: #1e1b4b; --color-indigo-950: #0d0c2a;
  --color-success: #22c55e; --color-warning: #f59e0b; --color-danger: #ef4444;

  /* Fonts (Space Grotesk + SUIT are self-hosted on the platform; fall back to system) */
  --font-display: "Space Grotesk", "SUIT", ui-sans-serif, system-ui, sans-serif;
  --font-ko: "SUIT", "Space Grotesk", ui-sans-serif, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;

  /* Motion */
  --duration-fast: 150ms; --duration-normal: 250ms; --duration-slow: 400ms; --duration-slower: 800ms;
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-soft: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* Radii */
  --radius-xs: 2px; --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-2xl: 20px;

  /* Shadows */
  --shadow-glow-indigo: 0 0 40px rgba(99, 102, 241, 0.35);
  --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

## Idioms

- **Dark by default**: `background: var(--color-ink); color: white;` with `color-scheme: dark`. For a light variant swap to `#fafafa` / `#111` under `prefers-color-scheme: light`.
- **Glass surface**: `background: color-mix(in srgb, var(--color-shadow) 52%, transparent); backdrop-filter: blur(14px) saturate(1.1); border: 1px solid color-mix(in srgb, white 18%, transparent); border-radius: var(--radius-lg);`
- **Hairline divider**: 1px, `linear-gradient(to right, rgba(255,255,255,.22), rgba(255,255,255,.12))`.
- **Stamp label** (section counters, eyebrows): mono, 11px, `letter-spacing: 0.24em`, uppercase, `color: color-mix(in srgb, var(--color-indigo-300) 80%, transparent)`. Number sections `01 — Title`.
- **Display type**: Space Grotesk 700, `letter-spacing: -0.03em`, tight leading. Korean text uses SUIT (`lang="ko"`).
- **Buttons**: primary `bg indigo-500 → hover indigo-400`; secondary `1px indigo-500 border, indigo-300 text`; ghost `white/75 text, white/6 hover bg`. Radius `--radius-md`, 150ms color transitions.
- **Focus**: `outline: 2px solid var(--color-indigo-500); outline-offset: 2px`.
- **Motion**: rise-in reveals (`translateY(20px) → 0`, 600ms `--ease-out-soft`); honor `prefers-reduced-motion`.

## Data surfaces (from aws-cost-dashboard)

- **Tabular figures** on anything compared column-wise: `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;` (apply to tables and number stacks).
- **Metric tile**: glass card; mono stamp label on top; the number in `metric-xl` (Space Grotesk 700, `letter-spacing: -0.04em`, `line-height: 0.95`, `clamp(2.25rem, 5vw, 3.5rem)`, tabular); a one-line hint below in 12px `rgba(255,255,255,.45)` saying what the number excludes or why it looks the way it does.
- **Panel title** is always the stamp label (`num-stamp`), never a bold heading.
- **Loading**: shimmer bars sized like the content they replace (`linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.1), rgba(255,255,255,.04))`, `background-size: 200% 100%`, 1.4s sweep). Never a spinner on a data surface.
- **Empty / error state**: a glass card (`p-8`) with stamp label, a `text-2xl font-bold tracking-[-0.02em]` heading, a 14px `white/55` explanation, and the exact command to run in a code block (`border 1px white/12`, `bg white/4`, mono 12px, indigo-200 text). Errors add a `border danger/30 bg danger/10` box with red-300 uppercase label.
- **Container**: `max-width: 1400px; padding: 0 20px` (32px from `sm`). Sections stagger in with `rise-in`.
- **Bar charts**: bars `bg indigo-500/30` with 1px gaps, a dashed `indigo-300/45` budget line, labels in `white/30` 11px mono.
- Skip the marketing devices (smooth scroll, ring cursor, marquees, oversized wordmark) on tools and dashboards.
