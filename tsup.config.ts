import type { Options } from 'tsup'

export default <Options>{
  entryPoints: ['src/*.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  external: ['pathe', '@vue/compiler-dom'],
  dts: true,
  onSuccess: 'npm run build:fix',
}
