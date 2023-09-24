import type { UnpluginFactory } from 'unplugin'
import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { parse, print, visit } from 'recast'
import { parser } from 'recast/parsers/babel'
import { namedTypes, builders as b, NodePath } from 'ast-types'
import { resolve } from 'pathe'
import { existsSync } from 'fs'

function isStr(value: unknown): value is string {
  return typeof value === 'string'
}

const blockInitializers = [
  'createBlock',
  'createCommentVNode',
  'createElementBlock',
  'createStaticVNode',
  'createTextVNode',
  'createVNode',
]

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = Extract<
  T,
  Record<K, V>
>

type MapDiscriminatedUnion<T extends Record<K, string>, K extends keyof T> = {
  [V in T[K]]: DiscriminateUnion<T, K, V>
}

type ASTNodeMap = MapDiscriminatedUnion<namedTypes.ASTNode, 'type'>

/**
 * A generic to type-narrow the given AST node to the given type of ast node.
 * @param node - The AST node to check.
 * @param type - The type of AST node to check against.
 */
function isType<T extends namedTypes.ASTNode['type']>(
  node: unknown,
  type: T,
): node is ASTNodeMap[T] {
  if (!node) return false
  return typeof node === 'object' && 'type' in node && node.type === type
}

/**
 * Attempt to get the import "from" value from the given AST node.
 * @param node - The AST node to check.
 */
function importFrom(node: namedTypes.Node): string | undefined {
  if (isType(node, 'ImportDeclaration') && isStr(node.source.value)) {
    return node.source.value
  }
  return undefined
}

function insertImport(
  path: NodePath,
  name: string,
  localNameOrFrom: string,
  from?: string,
) {
  // traverse to the root and insert the import there
  while (true) {
    if (!isType(path.node, 'Program')) {
      path = path.parent
      if (path) continue
    }
    break
  }
  const importDeclaration = b.importDeclaration(
    [
      b.importSpecifier(
        b.identifier('createVNode'),
        from ? b.identifier(localNameOrFrom) : undefined,
      ),
    ],
    b.stringLiteral(from ?? localNameOrFrom),
  )

  if (isType(path.node, 'Program')) {
    path.get('body').unshift(importDeclaration)
  }
}

/**
 * Walk the AST and inject the FormKitProvider into the code where needed. This
 * function works specifically for Vue 3 SFCs *after* @vitejs/plugin-vue has
 * processed them for frontend usage.
 *
 * @param code - The code to inject the FormKitProvider into.
 * @param configFile - The path to the FormKit configuration file.
 */
async function injectProvider(
  code: string,
  configFile?: string,
): Promise<{ code: string; map?: string }> {
  const ast = parse(code, { parser })
  const componentName = 'FormKitLazyProvider'
  // importedName => localName
  const blockInitializerExpressionNames: Record<string, string> = {}
  let importedFormKitLazyProvider: false | string = false

  visit(ast, {
    visitImportDeclaration(path) {
      this.traverse(path)
      if (!importedFormKitLazyProvider && importFrom(path.node) === 'vue') {
        // Add the FormKitProvider import
        path.insertAfter(
          b.importDeclaration(
            [
              b.importSpecifier(
                b.identifier(componentName),
                b.identifier(`__${componentName}`),
              ),
            ],
            b.stringLiteral('@formkit/vue'),
          ),
        )
        importedFormKitLazyProvider = '__' + componentName
      } else {
        this.traverse(path)
      }
    },
    visitImportSpecifier(path) {
      if (
        isType(path.node.imported, 'Identifier') &&
        importFrom(path.parent?.node) === 'vue'
      ) {
        if (path.node.imported.name === componentName) {
          importedFormKitLazyProvider = (path.node.local?.name ??
            path.node.imported.name) as string
        }
        // Get all the local names of the "createBlock" functions:
        if (blockInitializers.includes(path.node.imported.name)) {
          if (path.node.local?.name) {
            blockInitializerExpressionNames[path.node.imported.name as string] =
              path.node.local?.name as string
          } else {
            blockInitializerExpressionNames[path.node.imported.name as string] =
              path.node.imported.name
          }
        }
      }
      this.traverse(path)
    },
    visitCallExpression(path) {
      if (
        isType(path.node.callee, 'Identifier') &&
        Object.values(blockInitializerExpressionNames).includes(
          path.node.callee.name,
        ) &&
        isType(path.parent.node, 'SequenceExpression')
      ) {
        if (!('createVNode' in blockInitializerExpressionNames)) {
          insertImport(path as any, 'createVNode', '__createVNode', 'vue')
          blockInitializerExpressionNames['createVNode'] = '__createVNode'
        }
        const blockIndex = path.parent.node.expressions.indexOf(path.node)
        const blockExpression = path.parent.get('expressions', blockIndex)
        const callee = b.identifier(
          blockInitializerExpressionNames['createVNode'],
        )

        const simpleCall = b.callExpression(callee, [
          b.identifier(importedFormKitLazyProvider as string),
          configFile
            ? b.objectExpression([
                b.objectProperty(
                  b.identifier('configFile'),
                  // during `vite dev` the configFile is dynamically loaded
                  // this will be statically bundled during `vite build` by
                  // rewriting the @formkit/vue import to the correct path.
                  b.literal(configFile),
                ),
              ])
            : b.nullLiteral(),
          b.objectExpression([
            b.objectProperty(
              b.identifier('default'),
              b.arrowFunctionExpression([], blockExpression.node),
            ),
          ]),
        ])
        blockExpression.replace(simpleCall)
        // const blockExpression = parent.expressions[blockIndex];
        return false
      }
      this.traverse(path)
    },
  })

  return print(ast)
}

const FORMKIT_CONFIG_RE = /(\/\*\s?@__formkit\.config\.ts__\s?\*\/.+)\)/g

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
 * Determine if the file being processed is a vue file. This regex accounts for
 * query strings being appended to the file name.
 */
const VUE_FILE_RE = /\.vue(?:\?.+)?$/i

/**
 * A relatively cheap, albeit not foolproof, regex to determine if the code
 * being processed contains FormKit usage.
 */
const CONTAINS_FORMKIT_RE =
  /resolveComponent\("FormKit"\)|from ['"]@formkit\/vue['"]/

export const unpluginFactory: UnpluginFactory<Options | undefined> = (
  options: {
    configFile?: string
  } = { configFile: './formkit.config' },
) => {
  const configPath = resolveConfig(options.configFile || './formkit.config')

  return {
    name: 'unplugin-formkit',
    // webpack's id filter is outside of loader logic,
    // an additional hook is needed for better perf on webpack
    transformInclude(id: string) {
      return VUE_FILE_RE.test(id) || id.includes('@formkit/vue')
    },

    // just like rollup transform
    async transform(code) {
      // Replace all instances of `/* @__formkit_config__ */` in the code
      // with the resolved path to the formkit.config.{ts,js,mjs} file.
      if (configPath) {
        code = code.replace(FORMKIT_CONFIG_RE, `"${configPath}")`)
      }
      // Test if the given code is a likely candidate for FormKit usage.
      if (CONTAINS_FORMKIT_RE.test(code)) {
        const injectedCode = await injectProvider(code, configPath)
        return injectedCode
      }
      return code
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)
