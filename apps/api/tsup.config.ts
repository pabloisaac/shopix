import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  // Bundlear TODO — incluyendo dependencias del workspace y externas
  noExternal: [/.*/],
  // Excluir solo módulos nativos que no se pueden bundlear
  external: [
    'pino',
    'pino-pretty',
    'bufferutil',
    'utf-8-validate',
    'fsevents',
  ],
})
