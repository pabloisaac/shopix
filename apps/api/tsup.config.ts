import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  skipNodeModulesBundle: true,
  noExternal: ['@cripex/db', '@cripex/shared'],
})
