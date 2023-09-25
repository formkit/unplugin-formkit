import { describe, expect, it } from 'vitest'
import unplugin from '../src/vite'
import { readFileSync } from 'fs'

type Transformer = { transform: (code: string, id: string) => Promise<string> }
const aboutSFCFile = readFileSync('./playground/src/pages/about.vue', 'utf-8')
const contactSFCFile = readFileSync(
  './playground/src/pages/contact.vue',
  'utf-8',
)

const plugin: Transformer = unplugin() as Transformer

describe('index', () => {
  it('injects the template block into an normally structured sfc', async () => {
    expect(
      await plugin.transform(
        `<template>
  <FormKit />
</template>`,
        'test.vue',
      ),
    ).toMatchSnapshot()
  })

  it('injects import into script setup block', async () => {
    expect(await plugin.transform(aboutSFCFile, 'about.vue')).toMatchSnapshot()
  })

  it('injects setup block when using options api', async () => {
    expect(
      await plugin.transform(contactSFCFile, 'about.vue'),
    ).toMatchSnapshot()
  })
})
