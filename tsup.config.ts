import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  dts: false,
  entry: ['electron/main.ts', 'electron/preload.ts'],
  external: ['electron'],
  // Bundle everything else so the packaged app ships no node_modules.
  noExternal: [/.*/],
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  outDir: 'dist-electron',
  platform: 'node',
  sourcemap: true,
  splitting: false,
  minify: true,
  target: 'node22',
})
