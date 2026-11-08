/**
 * Vite config for the standalone visual preview harness.
 *
 * The app is rooted here (`vite scripts/preview`) but imports the real client
 * components from `../../src`, so the repo root has to stay readable by the
 * dev server. TypeScript is transpiled by esbuild (no typecheck here; that is
 * `pnpm typecheck`'s job) and `*.module.css` is handled by Vite's built-in CSS
 * modules, exactly like the tsdown build does.
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

/** @type {import('vite').UserConfig} */
export default {
  server: {
    port: 5199,
    strictPort: true,
    // `root` is scripts/preview, but the harness imports src/** and node_modules
    // symlinks from the repo root.
    fs: { allow: [repoRoot] },
  },
  esbuild: { jsx: 'automatic' },
  logLevel: 'info',
}
