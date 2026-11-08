# Visual preview harness (`scripts/preview`)

Renders the **real** `src/client/UsageSectionCard.tsx` and
`src/client/PlanUsageStrip.tsx` with synthetic data in a normal browser, so
design work does not need the authenticated DSH Web GUI (its per-process launch
token blocks direct browser access).

Everything here is a dev-only surface: it is not part of the plugin package
(`package.json` `files` does not include `scripts/`), it changes no `src/` file,
and it never runs `pnpm build` / `pnpm test`.

## Run

```powershell
# 1. Screenshots (starts/reuses vite by itself, writes PNGs):
python scripts/preview/shot.py                                  # overview + strip
python scripts/preview/shot.py --only all                       # + plans, settings, light, sparse, strip-open
python scripts/preview/shot.py --prefix dev-after               # after-redesign names
python scripts/preview/shot.py --only overview --width 900      # narrow layout probe

# 2. Or keep the dev server up and open it in a browser:
pnpm exec vite scripts/preview --port 5199 --strictPort
# http://127.0.0.1:5199/?part=section&theme=dark&tab=usage
```

`vite` is not a direct dependency; it resolves through the `vitest` dependency
via `pnpm exec`, so no `package.json` change is required.

`shot.py` prints the output path, byte size and CSS pixel dimensions of every
capture, and reports how long the harness took to become ready.

## URL parameters

| Param     | Values                                | Default   | Effect                                        |
| --------- | ------------------------------------- | --------- | --------------------------------------------- |
| `part`    | `section` \| `strip`                  | `section` | full plugins-page section, or composer strip  |
| `w`       | px                                    | `1232`    | harness container width (CSS px)              |
| `theme`   | `dark` \| `light`                      | `dark`    | emulated DSH colour scheme                    |
| `lang`    | `zh` \| `en`                           | `zh`      | sets `document.documentElement.lang` for `t()`|
| `tab`     | `usage` \| `plans` \| `settings`       | `usage`   | section tab to activate after mount           |
| `variant` | `rich` \| `sparse`                     | `rich`    | fixture shape (see below)                     |
| `updated` | `fresh` \| `stale`                     | `fresh`   | document age for the header freshness dot (`fresh` = 8 s, `stale` = 10 min) |
| `open`    | `1`                                    | –         | strip: open the quota popover on load         |

## Files

| File            | Role                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `index.html`    | Vite entry (`#root`, zh/dark defaults)                               |
| `harness.tsx`   | mounts the real components with a fake `UsageSectionFace`            |
| `fixture.ts`    | deterministic synthetic `UsageOverviewView` (`rich` / `sparse`)      |
| `theme.css`     | page chrome + the `--dsw-*` DSH theme aliases the component CSS reads |
| `vite.config.ts`| port 5199, `server.fs.allow` = repo root, automatic JSX              |
| `shot.py`       | Playwright driver (starts vite, waits for render, writes PNGs)       |

The fake face is intentionally tiny: `store` is an object with stable
`subscribe`/`getSnapshot`, `settings` returns a ready `configForms` snapshot,
and `poll`/`refresh`/`setCredential`/`clearCredential` are no-ops. Nothing is
fetched, so no DSH host or network is involved. The components import
`@deepseek-ai/dsh-client-store` types only (type-only imports are erased), so
the harness runs on plain React + Vite.

## Fixture data

`rich` (default):

- 3 providers: `opencode-go` is `current` with a `Go 20` plan exposing
  `5h 63.5%` / `week 78.2%` (warning tone) / `month 18.4%`, resets in 2 h / 3 d
  / 17 d, windows deliberately unsorted; `deepseek` has a `CNY ¥23.17` balance
  and no plan; `kimi-coding` has `week 46%` / `month 22.5%`.
- 182 ascending daily rows ending today: the last two weeks are dense, older
  history decays to isolated days, weekends dip, two consecutive idle days sit
  inside the last fortnight (visible heatmap gap), and the daily provider mix
  rotates (opencode-go-heavy / DeepSeek-heavy / Kimi-heavy days) so the 30-day
  trend card is not uniform.
- `usage.today`, `usage.range` (30 d) and `usage.all` (182 d) provider+model
  aggregates, `externalCredentials` with CPAMC configured and Volcano unset.
- `updatedAt` is **wall-clock** (`Date.now() - 8 s`) so the header freshness dot
  (`Date.now() - updatedAt < 30 s`) renders live; `?updated=stale` makes it 10
  minutes old to capture the dimmed state. Charts and day rows stay pinned to
  `2026-11-08T07:06Z` so every other pixel is identical between runs.

`sparse` (`?variant=sparse`): one unpriced provider, no plan windows, almost no
history — exercises the "no plan configured", empty-plans-tab, empty-heatmap
and balance-inline states.

## Screenshots

`docs/screenshots/dev-baseline-*.png` were captured on 2026-11-08 15:25
(Asia/Shanghai) at `--width 1232` (viewport 1280x1100, DPR 2), **before** the
redesign of `src/client/*` started, so they are the "before" reference. Because
`src/client/*` has since changed, re-running the harness now renders the current
working tree — that is the "after" shot; the baseline PNGs are not reproducible
from the tree anymore.

Sizes / dimensions of the baseline set (all DPR 2):

| File                                | Bytes   | pixels     |
| ----------------------------------- | ------- | ---------- |
| `dev-baseline-overview.png`         | 379 381 | 2560x2200  |
| `dev-baseline-overview-light.png`   | 379 566 | 2560x2200  |
| `dev-baseline-plans.png`            | 158 115 | 2560x2200  |
| `dev-baseline-settings.png`         | 228 352 | 2560x2200  |
| `dev-baseline-sparse.png`           | 289 073 | 2560x2200  |
| `dev-baseline-strip.png`            | 22 783  | 1180x124   |
| `dev-baseline-strip-open.png`       | 62 977  | 1180x684   |

## Notes

- The harness stubs `fetch` for `/api/dsh-usage-plus/*` and ships an inline
  empty favicon, so `PlanUsageStrip`'s diagnostic beacon and the browser's
  missing-favicon request do not log 404s. The page console stays clean, which
  makes a real error (missing locale key, React warning, failed import)
  impossible to miss.
- Playwright comes from the Python package at
  `D:\Software\Java\python-3.13.2`; `%LOCALAPPDATA%\ms-playwright` has no
  browser build on this machine, so `shot.py` launches the installed system
  Chrome (`--channel chrome`, falling back to `msedge`). Use
  `--channel ""` to force a bundled Chromium if one is ever installed.
- `shot.py` never kills a dev server it did not start: it reuses anything
  already listening on `--url`.
- The strip screenshot is an element capture (`[data-shot="strip"]`); section
  screenshots are full page at exactly the viewport height because
  `.preview-frame` has `min-height: calc(100vh - 48px)`.
