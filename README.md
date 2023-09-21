# unplugin-formkit

This is an [unplugin](https://github.com/unjs/unplugin) (Vite, Rollup, Webpack, and esbuild) build tool for injecting [FormKit](https://formkit.com) into your Vue 3 application.

> **Note:** This plugin is still still experimental and may change in the future.

## What is it?

This plugin eliminates the need to register the global formkit plugin. Instead, it will automatically inject FormKit into your Vue 3 application at the point of use.

By default it will attempt to load a `formkit.config.{ts,js,mjs}` file in the root of your project.

```vue
<script setup>
import { FormKit } from '@formkit/vue'
</script>

<template>
  <FormKit type="form">
    <ForKit
      type="text"
      name="username"
    />
    <ForKit
      type="password"
      name="password"
    />
  </FormKit>
</template>
```

Into the following:


```vue
<script setup>
import { FormKit, FormKitConfigProvider } from '@formkit/vue'
</script>

<template>
  <Suspense>
    <FormKitConfigProvider :config="./formkit.config.ts">
      <FormKit type="form">
        <ForKit
          type="text"
          name="username"
        />
        <ForKit
          type="password"
          name="password"
        />
      </FormKit>
    </FormKit>
  </Suspense>
</template>
```

> **Note:** The `<Suspense>` boundary and configuration loader is only injected if not already in the component tree.


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


