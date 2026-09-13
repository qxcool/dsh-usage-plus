# dsh-usage-plus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an independently installable DSH usage and plan-quota plugin with a current-provider composer strip.

**Architecture:** Fork the installed Apache-2.0 dsh-usage source into a separately named package. Extend its normalized plan windows and ledger summaries, add safe provider adapters, and register a compact client component in `conversation.input.dock`.

**Tech Stack:** TypeScript, React 18, Cordis/DSH bundle patches, Vitest, tsdown.

---

### Task 1: Establish the independent package identity

**Files:**
- Modify: `package.json`
- Modify: `cordis.patch.yml`
- Modify: `src/index.ts`
- Modify: `src/client/index.ts`
- Modify: `README.md`

1. Rename the npm package and every public namespace to `dsh-usage-plus`.
2. Give the bundle row a unique `usage-plus` id.
3. Verify no runtime identifier still collides with `@linxin666/dsh-usage`.
4. Commit the independent package baseline.

### Task 2: Tighten official Plan window semantics

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/host/usage-service.ts`
- Test: `test/plan-visibility.test.ts`

1. Write failing tests proving providers without a real Plan endpoint remain hidden.
2. Mark normalized windows as official data.
3. Resolve supported Provider ids and credentials from the existing model configuration.
4. Verify no local token estimate is exposed as Plan quota.

### Task 3: Extend official Plan adapters

**Files:**
- Modify: `src/core/adapters.ts`
- Create: `src/core/volcengine.ts`
- Create: `src/core/cliproxyapi.ts`
- Test: `test/provider-plans.test.ts`

1. Preserve the existing MiniMax, OpenCode Go, Kimi, GLM and Codex parsers.
2. Add fixture-tested Volcano Ark 5h/week/month normalization.
3. Add CPAMC as a separately configured CLIProxyAPI source, including normalized account/window and WorkBuddy credits parsing.
4. Enforce fixed routes, loopback/allowlist validation and redirect refusal.

### Task 4: Add the composer Plan strip

**Files:**
- Create: `src/client/PlanUsageStrip.tsx`
- Modify: `src/client/index.ts`
- Modify: `src/client/usage.module.css`
- Modify: `src/client/locales.ts`
- Test: `test/plan-strip.test.tsx`

1. Register `conversation.input.dock` with a unique `dsh-usage-plus-plan-strip` id.
2. Follow the current model Provider and show only its windows.
3. Render official percentages with warning colours and render nothing when the current Provider has no real window.
4. Add reset-time tooltips, manual refresh and loading/error states.

### Task 5: Build, install and verify

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `vitest.config.ts`
- Update: `lib/**`

1. Install exact development dependencies.
2. Run unit tests and type checking.
3. Build committed `lib` artifacts.
4. Install the local package into the desktop profile while disabling the old standalone usage bundle.
5. Restart DSH and verify the host route, settings section, composer strip and clean logs.

### Task 6: Package and publish

**Files:**
- Modify: `README.md`
- Modify: `README.zh.md`
- Create: `.gitignore`
- Create: `CHANGELOG.md`

1. Document credentials, supported Providers, official versus estimated semantics, installation and removal.
2. Run an install smoke test from a clean temporary profile.
3. Tag the first release.
4. Create the user-approved GitHub repository and push.
5. Prepare the DSH marketplace catalog submission metadata.
