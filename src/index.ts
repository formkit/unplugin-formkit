import type { UnpluginFactory } from 'unplugin'
import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { resolve } from 'pathe'
import { existsSync } from 'fs'
import { parse } from '@vue/compiler-dom'
import type { RootNode, ElementNode, AttributeNode } from '@vue/compiler-dom'

function getRootBlock(
  root: RootNode,
  block: 'template' | 'script' | 'style',
): ElementNode | undefined {
  return root.children.find((node) => node.type === 1 && node.tag === block) as
    | ElementNode
    | undefined
}

/**
 * Checks if a given script node is a setup script.
 * @param node a script node
 */
function isSetupScript(node: ElementNode) {
  return node.props.some((prop) => prop.type === 6 && prop.name === 'setup')
}

function langAttr(node?: ElementNode): string {
  if (!node) return ''
  const langProp = node.props.find(
    (prop) => prop.type === 6 && prop.name === 'lang',
  ) as AttributeNode | undefined
  if (langProp && langProp.value?.content) {
    return ` lang="${langProp.value.content}"`
  }
  return ''
}

/**
 * Imports `FormKitLazyProvider` component into the script block of the SFC.
 * @param code - The SFC source code.
 * @param id - The ID of the SFC file.
 */
function injectProviderImport(code: string): string {
  let root: RootNode
  try {
    root = parse(code)
  } catch (err) {
    console.warn('Failed to parse SFC:', code)
    console.error(err)
    return code
  }
  const script = getRootBlock(root, 'script')
  const importStatement = `import { FormKitLazyProvider } from '@formkit/vue'`
  const setupScript = root.children.find(
    (node) => node.type === 1 && node.tag === 'script' && isSetupScript(node),
  ) as ElementNode | undefined
  if (!setupScript) {
    return `<script setup${langAttr(script)}>${importStatement}</script>
${code}`
  }
  const startAt = setupScript.children[0].loc.start.offset
  const before = code.substring(0, startAt)
  const after = code.substring(startAt)
  return `${before}\n${importStatement}${after}`
}

/**
 * Injects the `<FormKitLazyProvider>` component import into the SFC.
 * @param code - The SFC source code.
 * @param id - The ID of the SFC file.
 */
function injectProviderComponent(code: string, id: string): string {
  let root: RootNode
  try {
    root = parse(code)
  } catch (err) {
    console.warn('Failed to parse SFC:', code)
    console.error(err)
    return code
  }
  const open = '<FormKitLazyProvider>'
  const close = '</FormKitLazyProvider>'
  const template = getRootBlock(root, 'template')
  if (!template) {
    console.warn(
      `To <template> block found in ${id}. Skipping FormKitLazyProvider injection.`,
    )
    return code
  }
  const before = code.substring(0, template.loc.start.offset + 10)
  const content = code.substring(
    template.loc.start.offset + 10,
    template.loc.end.offset - 11,
  )
  const after = code.substring(template.loc.end.offset - 11)
  code = `${before}\n${open}${content}${close}\n${after}`
  return code
}

/**
 * Resolve the absolute path to the configuration file.
 * @param configFile - The configuration file to attempt to resolve.
 */
function resolveConfig(configFile: string): string | undefined {
  const exts = ['ts', 'mjs', 'js']
  const cwd = process.cwd()
  let paths: string[] = []

  if (exts.some((ext) => configFile.endsWith(ext))) {
    // If the config file has an extension, we don't need to try them all.
    paths = [resolve(cwd, configFile)]
  } else {
    // If the config file doesn’t have an extension, try them all.
    paths = exts.map((ext) => resolve(cwd, `${configFile}.${ext}`))
  }
  return paths.find((path) => existsSync(path))
}

/**
 * A relatively cheap, albeit not foolproof, regex to determine if the code
 * being processed contains FormKit usage.
 */
const CONTAINS_FORMKIT_RE = /<FormKit|<form-kit/

/**
 * A regex to find the @__formkit_config__ comment in the code.
 */
const FORMKIT_CONFIG_RE = /(\/\*\s?@__formkit\.config\.ts__\s?\*\/.+)\)/g

export const unpluginFactory: UnpluginFactory<Options | undefined> = (
  options = { configFile: './formkit.config' },
) => {
  const configPath = resolveConfig(options.configFile || './formkit.config')

  return {
    name: 'unplugin-formkit',
    // webpack's id filter is outside of loader logic,
    // an additional hook is needed for better perf on webpack
    transformInclude(id: string) {
      return id.endsWith('.vue') || id.includes('@formkit/vue')
    },

    // just like rollup transform
    async transform(code, id) {
      // Replace all instances of `/* @__formkit_config__ */` in the code
      // with the resolved path to the formkit.config.{ts,js,mjs} file.
      if (configPath) {
        code = code.replace(FORMKIT_CONFIG_RE, `"${configPath}")`)
      }
      // Test if the given code is a likely candidate for FormKit usage.
      if (id.endsWith('.vue') && CONTAINS_FORMKIT_RE.test(code)) {
        code = injectProviderComponent(injectProviderImport(code), id)
      }
      return code
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)
