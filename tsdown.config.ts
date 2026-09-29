import { defineConfig } from 'tsdown'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Official DSH client contract (https://dsh.pub/develop-plugin.md):
 *   - emit `lib/client.js` (classic script, not ESM)
 *   - register via `window.__ModuleLoader__.load({ id: <package name>, factory })`
 *   - CSS side effects live inside the factory, never at top level
 *   - platform modules stay as literal require() calls so the DSH loader can
 *     discover and provide them across Desktop releases
 */
const PACKAGE_NAME = 'dsh-usage-plus'

const dshClientModuleLoader = {
  name: 'dsh-module-loader',
  writeBundle(outputOptions: { dir?: string }) {
    const outDir = outputOptions.dir ?? 'lib'
    // tsdown may emit client.cjs under "type":"module"; normalize to client.js.
    const cjsPath = join(outDir, 'client.cjs')
    const jsPath = join(outDir, 'client.js')
    const srcPath = existsSync(cjsPath) ? cjsPath : jsPath
    const cssPath = join(outDir, 'style.css')
    if (!existsSync(srcPath)) return

    let code = readFileSync(srcPath, 'utf8')
    // Defensive: never let a css import escape to top level of the bundle.
    code = code.replace(/^\s*import\s+['"][^'"]+\.css['"]\s*;\s*\r?\n?/gm, '')

    let css = ''
    if (existsSync(cssPath)) {
      css = readFileSync(cssPath, 'utf8')
      rmSync(cssPath, { force: true })
      rmSync(`${cssPath}.map`, { force: true })
    }

    const styleInject = css
      ? `(function(){if(typeof document==="undefined")return;if(document.querySelector('style[data-plugin-css="${PACKAGE_NAME}/client"]'))return;var tag=document.createElement("style");tag.dataset.plugin=${JSON.stringify(PACKAGE_NAME)};tag.dataset.pluginCss=${JSON.stringify(`${PACKAGE_NAME}/client`)};tag.textContent=${JSON.stringify(css)};document.head.appendChild(tag);})();\n`
      : ''

    const wrapped =
      `window.__ModuleLoader__.load({\n` +
      `\tid: ${JSON.stringify(PACKAGE_NAME)},\n` +
      `\tfactory: (require) => {\n` +
      `\t\tvar module = { exports: {} };\n` +
      `\t\tvar exports = module.exports;\n` +
      `\t\t${styleInject}${code}\n` +
      `\t\treturn module.exports;\n` +
      `\t}\n` +
      `});\n`

    writeFileSync(jsPath, wrapped)
    if (srcPath !== jsPath) rmSync(srcPath, { force: true })
    rmSync(`${jsPath}.map`, { force: true })
    rmSync(`${cjsPath}.map`, { force: true })
    // Drop leftover dts for the cjs filename if present.
    rmSync(join(outDir, 'client.d.cts'), { force: true })
  },
}

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    sourcemap: true,
    clean: false,
    fixedExtension: false,
    external: [/^@deepseek-ai\//, /^react(?:\/.*)?$/],
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    sourcemap: false,
    clean: false,
    fixedExtension: false,
    // Do NOT let tsdown add `import './style.css'` to the bundle: the DSH
    // loader executes client bundles as classic scripts, where a top-level
    // `import` is a SyntaxError that prevents factory registration.
    css: { inject: false },
    external: [/^@deepseek-ai\//, /^react(?:\/.*)?$/],
    plugins: [dshClientModuleLoader],
  },
])
