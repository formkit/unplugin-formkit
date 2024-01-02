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
  const node = root.children.find(
    (node) => node.type === 1 && node.tag === block,
  ) as ElementNode | undefined
  if (node && block === 'template' && node.children.length === 1) {
    const rootChild = node.children[0].type === 1 ? node.children[0] : undefined
    const tag = (rootChild?.tag ?? '').toLocaleLowerCase()
    if (
      rootChild &&
      tag !== 'formkit' &&
      tag !== 'form-kit' &&
      tag !== 'formkitschema' &&
      tag !== 'form-kit-schema' &&
      !rootChild.isSelfClosing
    ) {
      // In this case the component has a root node that is not formkit and is
      // not self-closing, like, perhaps, a div. We need to move the provider
      // inside this div instead of outside it.
      return rootChild
    }
  }
  return node
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
function injectProviderComponent(
  code: string,
  id: string,
  config?: boolean,
  defaultConfig?: boolean,
): { code: string; map?: any } {
  let root: RootNode
  try {
    root = parse(code)
  } catch (err) {
    console.warn('Failed to parse SFC:', code)
    console.error(err)
    return { code }
  }
  const open = `<FormKitLazyProvider${config ? ' config-file="true"' : ''}${
    defaultConfig ? '' : ' :default-config="false"'
  }>`
  const close = '</FormKitLazyProvider>'
  const template = getRootBlock(root, 'template')
  if (!template) {
    console.warn(
      `To <template> block found in ${id}. Skipping FormKitLazyProvider injection.`,
    )
    return { code, map: null }
  }
  const startInsertAt = template.children[0].loc.start.offset
  const before = code.substring(0, startInsertAt)
  const content = code.substring(startInsertAt, template.loc.end.offset - 11)
  const after = code.substring(template.loc.end.offset - 11)
  code = `${before}\n${open}\n${content}\n${close}\n${after}`
  return { code, map: null }
}

/**
 * Resolve the absolute path to the configuration file.
 * @param configFile - The configuration file to attempt to resolve.
 */
function resolveConfig(configFile: string): string | undefined {
  const exts = ['ts', 'mjs', 'js']
  const dir = configFile.startsWith('.') ? process.cwd() : ''
  let paths: string[] = []

  if (exts.some((ext) => configFile.endsWith(ext))) {
    // If the config file has an extension, we don't need to try them all.
    paths = [resolve(dir, configFile)]
  } else {
    // If the config file doesn’t have an extension, try them all.
    paths = exts.map((ext) => resolve(dir, `${configFile}.${ext}`))
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
const FORMKIT_CONFIG_RE =
  /(\/\*\s?@__formkit\.config\.ts__\s?\*\/(?:.|\n)+?)\)/g

export const unpluginFactory: UnpluginFactory<Options | undefined> = (
  options = {
    configFile: './formkit.config',
    defaultConfig: true,
  },
) => {
  const configPath = resolveConfig(options.configFile || './formkit.config')

  return {
    name: 'unplugin-formkit',
    enforce: 'pre',
    vite: {
      config() {
        return {
          optimizeDeps: {
            exclude: ['@formkit/vue'],
          },
        }
      },
    },
    // webpack's id filter is outside of loader logic,
    // an additional hook is needed for better perf on webpack
    transformInclude() {
      // TODO: resolve why @formkit/vue is not always identifiable by the id
      // and remove this early return workaround:
      return true
      // return (
      //   id.endsWith('.vue') ||
      //   id.includes('@formkit/vue') ||
      //   id.includes('@formkit_vue') ||
      //   id.endsWith('packages/vue/dist/index.mjs')
      // )
    },

    // just like rollup transform
    async transform(code, id) {
      // Replace all instances of `/* @__formkit_config__ */` in the code
      // with the resolved path to the formkit.config.{ts,js,mjs} file.
      if (configPath && FORMKIT_CONFIG_RE.test(code)) {
        code = code.replace(FORMKIT_CONFIG_RE, `"${configPath}")`)
        if (options.defaultConfig === false) {
          // If the user has explicitly disabled the default config, we need
          // to remove the defaultConfig from the FormKitConfigLoader. We can
          // do this by cutting the /* @__default-config__ */ comment area.
          code = code.replace(
            /\/\* @__default-config__ \*\/(?:.|\n)+?\/\* @__default-config__ \*\//gi,
            '',
          )
        }
        // Parse the modified code using recast and return the code with a sourcemap.
        return { code, map: null }
      }
      // Test if the given code is a likely candidate for FormKit usage.
      if (id.endsWith('.vue') && CONTAINS_FORMKIT_RE.test(code)) {
        return injectProviderComponent(
          injectProviderImport(code),
          id,
          !!configPath,
          options.defaultConfig,
        )
      }
      return
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)
