import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import FormKit from '../src/vite'

export default defineConfig({
  plugins: [vue(), Inspect(), FormKit()],
  build: {
    minify: false,
  },
})
