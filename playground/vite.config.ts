import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import FormKit from '../src/vite'

export default defineConfig({
  plugins: [FormKit(), vue(), Inspect()],
  build: {
    minify: false,
  },
})
