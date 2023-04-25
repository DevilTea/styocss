import {
  isArray,
  type EventHookListener,
} from '@styocss/shared'
import {
  createEventHook,
  numberToAlphabets,
} from '@styocss/shared'

import type {
  AtomicStyleContent,
  Properties,
  AddedAtomicStyle,
  StyleItem,
  ResolvedStyoEngineConfig,
  ResolvedConmonConfig,
  CommonConfig,
  StyoEngineConfig,
  PresetConfig,
} from './types'

import { AliasResolver } from './AliasResolver'
import { MacroStyleNameResolver } from './MacroStyleNameResolver'
import { StyleGroupExtractor } from './StyleGroupExtractor'

export const ATOMIC_STYLE_NAME_PLACEHOLDER = '{a}'
export const ATOMIC_STYLE_NAME_PLACEHOLDER_RE_GLOBAL = /\{a\}/g

export const DEFAULT_SELECTOR_PLACEHOLDER = '{s}'
export const DEFAULT_SELECTOR_PLACEHOLDER_RE_GLOBAL = /\{s\}/g

function serializeAtomicStyleContentWithoutValue ({ nested, selector, important, property }: AtomicStyleContent) {
  return `[${nested}][${selector}][${important}][${property}]`
}

function serializeAtomicStyleContent ({ nested, selector, important, property, value }: AtomicStyleContent) {
  return `[${nested}][${selector}][${important}][${property}][${value == null ? null : value}]`
}

function optimizeAtomicStyleContentList (list: AtomicStyleContent[]) {
  const map = new Map<string, AtomicStyleContent>()
  list.forEach((content) => {
    const key = serializeAtomicStyleContentWithoutValue(content)
    const existedItem = map.get(key)
    if (existedItem == null) {
      map.set(key, content)
      return
    }
    if (content.value == null) {
      map.delete(key)
      return
    }

    map.delete(key)
    map.set(key, content)
  })
  return [...map.values()]
}

function parseProperties (cssString: string) {
  const result: Record<string, string> = {}
  let state: 'propName' | 'propValue' = 'propName'
  let propName = ''
  let propValue = ''
  let quoteChar = ''
  for (let i = 0; i < cssString.length; i++) {
    const char = cssString.charAt(i)
    switch (state) {
      case 'propName':
        if (char === ':') {
          propName = propName.trim()
          state = 'propValue'
        } else if (/[a-zA-Z0-9-]/.test(char)) {
          propName += char
        }
        break
      case 'propValue':
        if (!quoteChar && (char === '"' || char === '\'')) {
          quoteChar = char
          propValue += char
        } else if (quoteChar === char) {
          quoteChar = ''
          propValue += char
        } else if (!quoteChar && char === ';') {
          propValue = propValue.trim()
          result[propName] = propValue
          propName = ''
          propValue = ''
          state = 'propName'
        } else {
          propValue += char
        }
        break
    }
  }
  if (propName) {
    propValue = propValue.trim()
    result[propName] = propValue
  }
  return result
}

export const css = String.raw

export type CssFn = typeof css

export function style (...args: Parameters<typeof String.raw>) {
  const cssString = `${String.raw(...args).trim().replace(/\/\*[\s\S]*?\*\//g, '')};`
  const props = parseProperties(cssString)
  return props as Properties
}

export type StyleFn = typeof style

export class StyoEngine<
  AliasForNested extends string = string,
  AliasForSelector extends string = string,
  MacroStyleName extends string = string,
> {
  _config: StyoEngineConfig<AliasForNested, AliasForSelector, MacroStyleName>
  _prefix: string
  _defaultNested: string
  _defaultSelector: string
  _defaultImportant: boolean

  _aliasForNestedResolver: AliasResolver<AliasForNested>
  _aliasForSelectorResolver: AliasResolver<AliasForSelector>
  _styleGroupExtractor: StyleGroupExtractor<AliasForNested, AliasForSelector, MacroStyleName>
  _macroStyleNameResolver: MacroStyleNameResolver<AliasForNested, AliasForSelector, MacroStyleName>

  _addedGlobalStyleList: string[] = []
  _cachedAtomicStyleName = new Map<string, string>()
  _cachedMacroStyleNameToAtomicStyleContentListMap = new Map<string, AtomicStyleContent[]>()
  _atomicStylesMap = new Map<string, AddedAtomicStyle>()
  _atomicStyleAddedHook = createEventHook<AddedAtomicStyle>()

  constructor (config?: StyoEngineConfig<AliasForNested, AliasForSelector, MacroStyleName>) {
    this._config = config || {}
    const {
      prefix,
      defaultNested,
      defaultSelector,
      defaultImportant,
      aliasForNestedConfigList,
      aliasForSelectorConfigList,
      macroStyleConfigList,
    } = this._resolveStyoEngineConfig(config || {})

    this._prefix = prefix
    this._defaultNested = defaultNested
    this._defaultSelector = defaultSelector
    this._defaultImportant = defaultImportant

    this._aliasForNestedResolver = new AliasResolver()
    aliasForNestedConfigList.forEach((theConfig) => {
      if (theConfig.type === 'static') {
        const { type: _, ...rule } = theConfig
        this._aliasForNestedResolver.addStaticAliasRule(rule)
      } else if (theConfig.type === 'dynamic') {
        const { type: _, ...rule } = theConfig
        this._aliasForNestedResolver.addDynamicAliasRule(rule)
      }
    })
    this._aliasForSelectorResolver = new AliasResolver()
    aliasForSelectorConfigList.forEach((theConfig) => {
      if (theConfig.type === 'static') {
        const { type: _, ...rule } = theConfig
        this._aliasForSelectorResolver.addStaticAliasRule(rule)
      } else if (theConfig.type === 'dynamic') {
        const { type: _, ...rule } = theConfig
        this._aliasForSelectorResolver.addDynamicAliasRule(rule)
      }
    })
    this._macroStyleNameResolver = new MacroStyleNameResolver<AliasForNested, AliasForSelector, MacroStyleName>()
    macroStyleConfigList.forEach((theConfig) => {
      if (theConfig.type === 'static') {
        const { type: _, ...rule } = theConfig
        this._macroStyleNameResolver.addStaticMacroStyleRule(rule)
      } else if (theConfig.type === 'dynamic') {
        const { type: _, ...rule } = theConfig
        this._macroStyleNameResolver.addDynamicMacroStyleRule(rule)
      }
    })

    this._styleGroupExtractor = new StyleGroupExtractor({
      defaultNested,
      defaultSelector,
      defaultImportant,
      resolveAliasForNested: (alias) => this._aliasForNestedResolver.resolveAlias(alias),
      resolveAliasForSelector: (alias) => this._aliasForSelectorResolver.resolveAlias(alias),
      resolveMacroStyleNameToAtomicStyleContentList: (name) => this._resolveStyleItemList([name]),
    })
  }

  _resolveCommonConfig (config: CommonConfig<AliasForNested, AliasForSelector, MacroStyleName>): ResolvedConmonConfig<AliasForNested, AliasForSelector, MacroStyleName> {
    const resolvedConfig: ResolvedConmonConfig<AliasForNested, AliasForSelector, MacroStyleName> = {
      aliasForNestedConfigList: [],
      aliasForSelectorConfigList: [],
      macroStyleConfigList: [],
    }

    const {
      presets = [],
      aliases: {
        nested: aliasForNestedConfigList = [],
        selector: aliasForSelectorConfigList = [],
      } = {},
      macroStyles: macroStyleConfigList = [],
    } = config

    presets.forEach((preset) => {
      const resolvedPresetConfig = this._resolveCommonConfig(preset)
      resolvedConfig.aliasForNestedConfigList.push(...resolvedPresetConfig.aliasForNestedConfigList)
      resolvedConfig.aliasForSelectorConfigList.push(...resolvedPresetConfig.aliasForSelectorConfigList)
      resolvedConfig.macroStyleConfigList.push(...resolvedPresetConfig.macroStyleConfigList)
    })

    resolvedConfig.aliasForNestedConfigList.push(...aliasForNestedConfigList)
    resolvedConfig.aliasForSelectorConfigList.push(...aliasForSelectorConfigList)
    resolvedConfig.macroStyleConfigList.push(...macroStyleConfigList)

    return resolvedConfig
  }

  _resolveStyoEngineConfig (config: StyoEngineConfig<AliasForNested, AliasForSelector, MacroStyleName>): ResolvedStyoEngineConfig<AliasForNested, AliasForSelector, MacroStyleName> {
    const {
      prefix = '',
      defaultNested = '',
      defaultSelector = `.${ATOMIC_STYLE_NAME_PLACEHOLDER}`,
      defaultImportant = false,
      ...commonConfig
    } = config

    const resolvedCommonConfig = this._resolveCommonConfig(commonConfig)

    return {
      prefix,
      defaultNested,
      defaultSelector,
      defaultImportant,
      ...resolvedCommonConfig,
    }
  }

  _notifyAtomicStyleAdded (added: AddedAtomicStyle) {
    this._atomicStyleAddedHook.trigger(added)
  }

  _getAtomicStyleName (content: AtomicStyleContent) {
    const key = serializeAtomicStyleContent(content)
    const cached = this._cachedAtomicStyleName.get(key)
    if (cached != null)
      return cached

    const num = this._cachedAtomicStyleName.size
    const name = `${this.prefix}${numberToAlphabets(num)}`
    this._cachedAtomicStyleName.set(key, name)
    return name
  }

  _resolveStyleItemList (itemList: StyleItem<AliasForNested, AliasForSelector, MacroStyleName>[]) {
    const atomicStyleContentList: AtomicStyleContent[] = []
    itemList.forEach((styleItem) => {
      if (typeof styleItem === 'string') {
        const cached = this._cachedMacroStyleNameToAtomicStyleContentListMap.get(styleItem)
        if (cached != null) {
          atomicStyleContentList.push(...cached)
          return
        }

        this._macroStyleNameResolver
          .resolveMacroStyleName(styleItem)
          .forEach((group) => {
            atomicStyleContentList.push(...this._styleGroupExtractor.extract(group))
          })
      } else {
        atomicStyleContentList.push(...this._styleGroupExtractor.extract(styleItem))
      }
    })
    return optimizeAtomicStyleContentList(atomicStyleContentList)
  }

  _renderGlobalStyles (): string {
    return this._addedGlobalStyleList.join('')
  }

  _renderAtomicStyles (): string {
    // Render atomic rules
    const renderObjects = [...this.atomicStylesMap.values()]
      .map(({
        name,
        content: { nested, selector, important, property, value },
      }) => {
        if (
          !selector.includes(ATOMIC_STYLE_NAME_PLACEHOLDER)
          || value == null
        )
          return null

        const renderObject = {
          nested,
          selector: selector.replace(ATOMIC_STYLE_NAME_PLACEHOLDER_RE_GLOBAL, name),
          content: isArray(value)
            ? value.map((value) => `${property}:${value}${important ? ' !important' : ''}`).join(';')
            : `${property}:${value}${important ? ' !important' : ''}`,
        }

        return renderObject
      })
      .filter((i): i is NonNullable<typeof i> => i != null)

    const groupedByNestedMap = new Map</* nested */ string, Map</* content */ string, /* selectorList */ string[]>>()
    renderObjects.forEach(({ content, nested, selector }) => {
      const nestedMap = groupedByNestedMap.get(nested) || new Map()
      const selectorList = nestedMap.get(content) || []
      selectorList.push(selector)
      nestedMap.set(content, selectorList)
      groupedByNestedMap.set(nested, nestedMap)
    })

    const cssLines: string[] = []

    // Process the no-nested rules first
    const noNestedMap = groupedByNestedMap.get('')
    if (noNestedMap != null) {
      noNestedMap.forEach((selectorList, content) => {
        cssLines.push(`${selectorList.join(',')}{${content}}`)
      })
      groupedByNestedMap.delete('')
    }

    // Process the rest
    groupedByNestedMap.forEach((nestedMap, nested) => {
      const bodyLines: string[] = []
      nestedMap.forEach((selectorList, content) => {
        bodyLines.push(`${selectorList.join(',')}{${content}}`)
      })
      if (nested === '')
        cssLines.push(...bodyLines)
      else
        cssLines.push(`${nested}{${bodyLines.join('')}}`)
    })

    return cssLines.join('')
  }

  get config () {
    return this._config
  }

  get prefix () {
    return this._prefix
  }

  get defaultNested () {
    return this._defaultNested
  }

  get defaultSelector () {
    return this._defaultSelector
  }

  get defaultImportant () {
    return this._defaultImportant
  }

  get staticAliasForNestedRuleList () {
    return this._aliasForNestedResolver.staticAliasRuleList
  }

  get dynamicAliasForNestedRuleList () {
    return this._aliasForNestedResolver.dynamicAliasRuleList
  }

  get staticAliasForSelectorRuleList () {
    return this._aliasForSelectorResolver.staticAliasRuleList
  }

  get dynamicAliasForSelectorRuleList () {
    return this._aliasForSelectorResolver.dynamicAliasRuleList
  }

  get staticMacroStyleRuleList () {
    return this._macroStyleNameResolver.staticMacroStyleRuleList
  }

  get dynamicMacroStyleRuleList () {
    return this._macroStyleNameResolver.dynamicMacroStyleRuleList
  }

  get atomicStylesMap () {
    return new Map(this._atomicStylesMap)
  }

  // TODO: implement warning
  // onWarned (fn: EventHookListener<EngineWarning>) {
  //   return this.#atomicMacroItemEngine.onWarned(fn)
  // }

  onAtomicStyleAdded (listener: EventHookListener<AddedAtomicStyle>) {
    return this._atomicStyleAddedHook.on(listener)
  }

  globalStyo (cssString: string) {
    const minified = cssString.replace(/\s+/g, ' ').trim()
    if (minified === '')
      return

    this._addedGlobalStyleList.push(minified)
  }

  styo (...itemList: [StyleItem<AliasForNested, AliasForSelector, MacroStyleName>, ...StyleItem<AliasForNested, AliasForSelector, MacroStyleName>[]]) {
    const atomicStyleContentList = this._resolveStyleItemList(itemList)
    const atomicStyleNameList: string[] = []
    atomicStyleContentList.forEach((content) => {
      const name = this._getAtomicStyleName(content)
      atomicStyleNameList.push(name)
      if (!this._atomicStylesMap.has(name)) {
        const registered = {
          name,
          content,
        }
        this._atomicStylesMap.set(
          name,
          registered,
        )
        this._notifyAtomicStyleAdded(registered)
      }
    })
    return atomicStyleNameList
  }

  renderStyles () {
    return [
      '/* Global Styles */',
      this._renderGlobalStyles(),
      '/* Atomic Styles */',
      this._renderAtomicStyles(),
    ].join('')
  }
}

export function createStyoEngine<
  AliasForNested extends string,
  AliasForSelector extends string,
  MacroStyleName extends string,
> (config?: StyoEngineConfig<AliasForNested, AliasForSelector, MacroStyleName>) {
  return new StyoEngine<AliasForNested, AliasForSelector, MacroStyleName>(config)
}

export function defineStyoConfig<
  AliasForNested extends string,
  AliasForSelector extends string,
  MacroStyleName extends string,
> (config: StyoEngineConfig<AliasForNested, AliasForSelector, MacroStyleName>) {
  return config
}

export function defineStyoPreset<
  AliasForNested extends string,
  AliasForSelector extends string,
  MacroStyleName extends string,
> (config: PresetConfig<AliasForNested, AliasForSelector, MacroStyleName>) {
  return config
}
