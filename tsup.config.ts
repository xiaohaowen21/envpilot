import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  dts: false,
  entry: ['electron/main.ts', 'electron/preload.ts'],
  // Bundle everything except Electron's built-in module, so the packaged app
  // ships no node_modules. noExternal wins over external, hence the lookahead.
  external: ['electron'],
  noExternal: [/^(?!electron$)/],
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  outDir: 'dist-electron',
  platform: 'node',
  sourcemap: true,
  splitting: false,
  minify: true,
  target: 'node22',
})
