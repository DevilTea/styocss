import { isAbsolute, resolve } from 'node:path'
import { writeFile } from 'fs/promises'
import type { Plugin as VitePlugin } from 'vite'
import { transformWithEsbuild } from 'vite'
import { normalizePath } from 'vite'
import { resolveModule } from 'local-pkg'
import type { StyoPluginOptions } from './shared/types'
import { DevPlugin } from './dev'
import { BuildPlugin } from './build'
import { createCtx } from './shared'

function StyoPlugin (options: Omit<StyoPluginOptions, 'transformTsToJs'> = {}): VitePlugin[] {
  const ctx = createCtx({
    ...options,
    transformTsToJs: async (tsCode) => (await transformWithEsbuild(tsCode, 'temp.ts')).code,
  })

  const plugins: VitePlugin[] = [
    ...DevPlugin(ctx),
    ...BuildPlugin(ctx),
  ]

  if (ctx.dts) {
    plugins.unshift({
      name: 'styocss:dev:dts',
      async configResolved (config) {
        if (ctx.dts === false)
          return

        const { root } = config

        const normalizedDts = normalizePath(ctx.dts)
        const dtsPath = isAbsolute(normalizedDts)
          ? normalizedDts
          : resolve(root, normalizedDts)

        const { nameOfStyoFn } = ctx
        const aliasForNestedList = [
          ...ctx.engine.staticAliasForNestedRuleList.map(({ alias }) => alias),
          ...ctx.engine.dynamicAliasForNestedRuleList.flatMap(({ exampleList }) => exampleList),
        ].map((alias) => `'${alias}'`)
        const aliasForSelectorList = [
          ...ctx.engine.staticAliasForSelectorRuleList.map(({ alias }) => alias),
          ...ctx.engine.dynamicAliasForSelectorRuleList.flatMap(({ exampleList }) => exampleList),
        ].map((alias) => `'${alias}'`)
        const macroStyleNameList = [
          ...ctx.engine.staticMacroStyleRuleList.map(({ name }) => name),
          ...ctx.engine.dynamicMacroStyleRuleList.flatMap(({ exampleList }) => exampleList),
        ].map((name) => `'${name}'`)

        const hasVue = !!resolveModule('vue', { paths: [root] })
        const dtsContent = [
          '// Auto-generated by @styocss/vite-plugin-styocss',
          'import type { StyoEngine, StyleFn, CssFn } from \'@styocss/vite-plugin-styocss\'',
          '',
          'type _StyoFn = StyoEngine<',
          `  /* AliasForNested */ ${aliasForNestedList.length > 0 ? aliasForNestedList.join(' | ') : 'never'},`,
          `  /* AliasForSelector */ ${aliasForSelectorList.length > 0 ? aliasForSelectorList.join(' | ') : 'never'},`,
          `  /* MacroStyleName */ ${macroStyleNameList.length > 0 ? macroStyleNameList.join(' | ') : 'never'},`,
          '>[\'styo\']',
          '',
          ...ctx.autoJoin
            ? [
                'type StyoFn = (...params: Parameters<_StyoFn>) => string',
              ]
            : [
                'type StyoFn = _StyoFn',
              ],
          '',
          'declare global {',
          `  const ${nameOfStyoFn}: StyoFn`,
          '  const style: StyleFn',
          '  const css: CssFn',
          '}',
          ...hasVue
            ? [
                '',
                'declare module \'vue\' {',
                '  interface ComponentCustomProperties {',
                `    ${nameOfStyoFn}: StyoFn`,
                '    style: StyleFn',
                '    css: CssFn',
                '  }',
                '}',
              ]
            : [],
        ].join('\n')
        await writeFile(dtsPath, dtsContent)
      },
    })
  }

  return plugins
}

export type {
  StyoEngine,
  StyleFn,
  CssFn,
} from '@styocss/core'

export {
  defineStyoEngineConfig,
} from '@styocss/core'

export default StyoPlugin
