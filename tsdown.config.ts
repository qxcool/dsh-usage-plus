import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    sourcemap: true,
    clean: false,
    fixedExtension: false,
    external: [/^@deepseek-ai\//, /^react(?:\/.*)?$/, 'schemastery'],
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'esm',
    sourcemap: true,
    clean: false,
    fixedExtension: false,
    injectStyle: true,
    external: [/^@deepseek-ai\//, /^react(?:\/.*)?$/],
  },
])
