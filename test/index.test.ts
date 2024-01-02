import { describe, expect, it } from 'vitest'
import unplugin from '../src/vite'
import { readFileSync } from 'fs'

type Transformer = {
  transform: (code: string, id: string) => Promise<{ code: string; map?: any }>
}
const aboutSFCFile = readFileSync('./playground/src/pages/about.vue', 'utf-8')
const contactSFCFile = readFileSync(
  './playground/src/pages/contact.vue',
  'utf-8',
)

const plugin: Transformer = unplugin() as Transformer

describe('index', () => {
  it('injects the template block into an normally structured sfc', async () => {
    expect(
      (
        await plugin.transform(
          `<template>
  <FormKit />
</template>`,
          'test.vue',
        )
      ).code,
    ).toMatchSnapshot()
  })

  it('injects inside root node if there is one', async () => {
    expect(
      (
        await plugin.transform(
          `<template>
    <div class="fizzbuzz">
      <FormKit />
    </div>
  </template>`,
          'test.vue',
        )
      ).code,
    ).toMatchSnapshot()
  })

  it('injects inside root node with full sfc', async () => {
    expect(
      (
        await plugin.transform(
          `<script lang="ts" setup>
function handleLoginSubmit(values: any) {
  window.alert("You are logged in. Credentials: \n" + JSON.stringify(values));
}
</script>

<template>
  <div>
    <FormKit type="form" submit-label="login" @submit="handleLoginSubmit">
      <FormKit type="email" label="Email" name="email" />
      <FormKit type="password" label="Password" name="password" />
    </FormKit>
  </div>
</template>
`,
          'test.vue',
        )
      ).code,
    ).toMatchSnapshot()
  })

  it('injects import into script setup block', async () => {
    expect(
      (await plugin.transform(aboutSFCFile, 'about.vue')).code,
    ).toMatchSnapshot()
  })

  it('injects setup block when using options api', async () => {
    expect(
      (await plugin.transform(contactSFCFile, 'about.vue')).code,
    ).toMatchSnapshot()
  })
})
