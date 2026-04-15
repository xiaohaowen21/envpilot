import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  dts: false,
  entry: ['electron/main.ts', 'electron/preload.ts'],
  external: ['electron'],
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  outDir: 'dist-electron',
  platform: 'node',
  sourcemap: true,
  splitting: false,
  target: 'node20',
})
