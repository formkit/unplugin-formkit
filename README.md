# unplugin-formkit

This is an [unplugin](https://github.com/unjs/unplugin) (Vite, Rollup, Webpack, and esbuild) build tool for injecting [FormKit](https://formkit.com) into your Vue 3 application.

> **Note:** This plugin is still in development and is not yet ready for production use.

## Installation

```bash
npm install unplugin-formkit --save-dev
```

Then add it to your `vite.config.ts` (or `rollup.config.ts` or webpack config etc).

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { formkit } from 'unplugin-formkit'

export default defineConfig({
  plugins: [
    vue(),
    formkit()
  ]
})
```

> **Important:** Order matters — this plugin should always be placed *after* the Vue plugin.

## Usage

Once installed, you can use FormKit in your Vue components without any further configuration — FormKit’s configuration will automatically be injected into your application at the point of use.

To add some FormKit configuration to your project, simply create a `formkit.config.ts` (or `.js` or `.mjs`) file in the root of your project (adjacent to your `vite.config.ts` file) and export a configuration object:

```ts
import { DefaultConfigOptions, createInput } from '@formkit/vue';

export default {
  inputs: {
    custom: createInput([
      {
        $el: 'h1',
        children: 'Super Custom Input!',
      },
    ]),
  },
} satisfies DefaultConfigOptions
```


