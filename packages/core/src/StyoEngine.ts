import type {
	EventHookListener,
} from './utils'
import {
	createEventHook,
	isArray,
	isNotNullish,
	numberToAlphabets,
	wrapWithNesting,
} from './utils'

import type {
	AddedAtomicStyle,
	AtomicStyleContent,
	CommonConfig,
	ResolvedCommonConfig,
	ResolvedStyoEngineConfig,
	StyleItem,
	StyoEngineConfig,
} from './types'

import { NestingAliasResolver } from './NestingAliasResolver'
import { SelectorAliasResolver } from './SelectorAliasResolver'
import { ShortcutResolver } from './ShortcutResolver'
import { StyleGroupExtractor } from './StyleGroupExtractor'
import {
	ATOMIC_STYLE_NAME_PLACEHOLDER,
	ATOMIC_STYLE_NAME_PLACEHOLDER_RE_GLOBAL,
} from './constants'

class StyoEngine<
  AliasForNesting extends string = string,
  AliasTemplateForNesting extends string = string,
  AliasForSelector extends string = string,
  AliasTemplateForSelector extends string = string,
  Shortcut extends string = string,
  ShortcutTemplate extends string = string,
> {
	private _config: StyoEngineConfig
	private _prefix: string
	private _defaultNesting: string[][]
	private _defaultSelector: string[]
	private _defaultImportant: boolean

	private _aliasForNestingResolver: NestingAliasResolver = new NestingAliasResolver()
	private _aliasForSelectorResolver: SelectorAliasResolver = new SelectorAliasResolver()
	private _shortcutResolver: ShortcutResolver = new ShortcutResolver()
	private _styleGroupExtractor: StyleGroupExtractor

	private _addedGlobalStyleList: string[] = []
	private _cachedAtomicStyleName = new Map<string, string>()
	private _cachedShortcutToAtomicStyleContentListMap = new Map<string, AtomicStyleContent[]>()
	private _atomicStylesMap = new Map<string, AddedAtomicStyle>()
	private _atomicStyleAddedHook = createEventHook<AddedAtomicStyle>()

	constructor(config?: StyoEngineConfig) {
		this._config = config || {}
		const {
			prefix,
			defaultNesting,
			defaultSelector,
			defaultImportant,
			aliasForNestingConfigList,
			aliasForSelectorConfigList,
			shortcutConfigList,
		} = this._resolveStyoEngineConfig(config || {})

		this._prefix = prefix
		this._defaultNesting = defaultNesting
		this._defaultSelector = defaultSelector
		this._defaultImportant = defaultImportant

		aliasForNestingConfigList.forEach((theConfig) => {
			if (theConfig.type === 'static') {
				const { type: _, ...rule } = theConfig
				this._aliasForNestingResolver.addStaticAliasRule(rule)
			}
			else if (theConfig.type === 'dynamic') {
				const {
					type: _,
					predefined = [],
					template = [],
					...rest
				} = theConfig
				const rule = {
					predefined,
					template,
					...rest,
				}
				this._aliasForNestingResolver.addDynamicAliasRule(rule)
			}
		})
		aliasForSelectorConfigList.forEach((theConfig) => {
			if (theConfig.type === 'static') {
				const { type: _, ...rule } = theConfig
				this._aliasForSelectorResolver.addStaticAliasRule(rule)
			}
			else if (theConfig.type === 'dynamic') {
				const {
					type: _,
					predefined = [],
					template = [],
					...rest
				} = theConfig
				const rule = {
					predefined,
					template,
					...rest,
				}
				this._aliasForSelectorResolver.addDynamicAliasRule(rule)
			}
		})
		shortcutConfigList.forEach((theConfig) => {
			if (theConfig.type === 'static') {
				const { type: _, ...rule } = theConfig
				this._shortcutResolver.addStaticShortcutRule(rule)
			}
			else if (theConfig.type === 'dynamic') {
				const {
					type: _,
					predefined = [],
					template = [],
					...rest
				} = theConfig
				const rule = {
					predefined,
					template,
					...rest,
				}
				this._shortcutResolver.addDynamicShortcutRule(rule)
			}
		})

		this._styleGroupExtractor = new StyleGroupExtractor({
			defaultNesting: this._defaultNesting,
			defaultSelector: this._defaultSelector,
			defaultImportant: this._defaultImportant,
			resolveAliasForNesting: alias => this._aliasForNestingResolver.resolveAlias(alias),
			resolveAliasForSelector: alias => this._aliasForSelectorResolver.resolveAlias(alias),
			resolveShortcutToAtomicStyleContentList: name => this._resolveStyleItemList([name]),
		})
	}

	private _resolveCommonConfig(config: CommonConfig): ResolvedCommonConfig {
		const resolvedConfig: ResolvedCommonConfig = {
			aliasForNestingConfigList: [],
			aliasForSelectorConfigList: [],
			shortcutConfigList: [],
		}

		const {
			presets = [],
			aliases: {
				nesting: aliasForNestingConfigList = [],
				selector: aliasForSelectorConfigList = [],
			} = {},
			shortcuts = [],
		} = config

		presets.forEach((preset) => {
			const resolvedPresetConfig = this._resolveCommonConfig(preset)
			resolvedConfig.aliasForNestingConfigList.push(...resolvedPresetConfig.aliasForNestingConfigList)
			resolvedConfig.aliasForSelectorConfigList.push(...resolvedPresetConfig.aliasForSelectorConfigList)
			resolvedConfig.shortcutConfigList.push(...resolvedPresetConfig.shortcutConfigList)
		})

		resolvedConfig.aliasForNestingConfigList.push(...aliasForNestingConfigList)
		resolvedConfig.aliasForSelectorConfigList.push(...aliasForSelectorConfigList)
		resolvedConfig.shortcutConfigList.push(...shortcuts)

		return resolvedConfig
	}

	private _resolveStyoEngineConfig(config: StyoEngineConfig): ResolvedStyoEngineConfig {
		const {
			prefix = '',
			defaultNesting = [],
			defaultSelector = [`.${ATOMIC_STYLE_NAME_PLACEHOLDER}`],
			defaultImportant = false,
			...commonConfig
		} = config

		const resolvedCommonConfig = this._resolveCommonConfig(commonConfig)

		return {
			prefix,
			defaultNesting: [defaultNesting].flat().map(item => [item].flat()),
			defaultSelector: [defaultSelector].flat(),
			defaultImportant,
			...resolvedCommonConfig,
		}
	}

	private _notifyAtomicStyleAdded(added: AddedAtomicStyle) {
		this._atomicStyleAddedHook.trigger(added)
	}

	private _getAtomicStyleName(content: AtomicStyleContent) {
		const key = serializeAtomicStyleContent(content)
		const cached = this._cachedAtomicStyleName.get(key)
		if (cached != null)
			return cached

		const num = this._cachedAtomicStyleName.size
		const name = `${this.prefix}${numberToAlphabets(num)}`
		this._cachedAtomicStyleName.set(key, name)
		return name
	}

	private _resolveStyleItemList(itemList: StyleItem[]) {
		const atomicStyleContentList: AtomicStyleContent[] = []
		itemList.forEach((styleItem) => {
			if (typeof styleItem === 'string') {
				const cached = this._cachedShortcutToAtomicStyleContentListMap.get(styleItem)
				if (cached != null) {
					atomicStyleContentList.push(...cached)
					return
				}

				this._shortcutResolver
					.resolveShortcut(styleItem)
					.forEach((group) => {
						atomicStyleContentList.push(...this._styleGroupExtractor.extract(group))
					})
			}
			else {
				atomicStyleContentList.push(...this._styleGroupExtractor.extract(styleItem))
			}
		})
		return optimizeAtomicStyleContentList(atomicStyleContentList)
	}

	private _renderGlobalStyles(): string {
		return this._addedGlobalStyleList.join('')
	}

	private _renderAtomicStyles(): string {
		// Render atomic rules
		const renderObjects = [...this.atomicStylesMap.values()]
			.map(({
				name,
				content: { nesting, selector, important, property, value },
			}) => {
				if (
					!selector.includes(ATOMIC_STYLE_NAME_PLACEHOLDER)
					|| value == null
				)
					return null

				const renderObject = {
					nesting,
					selector: selector.replace(ATOMIC_STYLE_NAME_PLACEHOLDER_RE_GLOBAL, name),
					content: isArray(value)
						? value.map(value => `${property}:${value}${important ? ' !important' : ''}`).join(';')
						: `${property}:${value}${important ? ' !important' : ''}`,
				}

				return renderObject
			})
			.filter(isNotNullish)
		const groupedByNestingMap = new Map</* key */ string, [levels: string[], map: Map</* content */ string, /* selectorList */ string[]>]>()
		renderObjects.forEach(({ content, nesting, selector }) => {
			const key = JSON.stringify(nesting)
			const tuple = groupedByNestingMap.get(key) || [nesting, new Map<string, string[]>()]
			const nestingMap = tuple[1]
			const selectorList = nestingMap.get(content) || []
			selectorList.push(selector)
			nestingMap.set(content, selectorList)
			groupedByNestingMap.set(key, tuple)
		})

		const cssLines: string[] = []

		// Process the no-nesting rules first
		const [, noNestingMap] = groupedByNestingMap.get('') || [[], undefined]
		if (noNestingMap != null) {
			noNestingMap.forEach((selectorList, content) => {
				cssLines.push(`${selectorList.join(',')}{${content}}`)
			})
			groupedByNestingMap.delete('')
		}

		// Process the rest
		groupedByNestingMap.forEach(([levels, nestingMap]) => {
			const bodyLines: string[] = []
			nestingMap.forEach((selectorList, content) => {
				bodyLines.push(`${selectorList.join(',')}{${content}}`)
			})
			if (levels.length === 0)
				cssLines.push(...bodyLines)

			else
				cssLines.push(wrapWithNesting(levels, bodyLines.join('')))
		})

		return cssLines.join('')
	}

	get config() {
		return this._config
	}

	get prefix() {
		return this._prefix
	}

	get defaultNesting() {
		return this._defaultNesting
	}

	get defaultSelector() {
		return this._defaultSelector
	}

	get defaultImportant() {
		return this._defaultImportant
	}

	get staticAliasForNestingRuleList() {
		return this._aliasForNestingResolver.staticAliasRuleList
	}

	get dynamicAliasForNestingRuleList() {
		return this._aliasForNestingResolver.dynamicAliasRuleList
	}

	get staticAliasForSelectorRuleList() {
		return this._aliasForSelectorResolver.staticAliasRuleList
	}

	get dynamicAliasForSelectorRuleList() {
		return this._aliasForSelectorResolver.dynamicAliasRuleList
	}

	get staticShortcutRuleList() {
		return this._shortcutResolver.staticShortcutRuleList
	}

	get dynamicShortcutRuleList() {
		return this._shortcutResolver.dynamicShortcutRuleList
	}

	get atomicStylesMap() {
		return new Map(this._atomicStylesMap)
	}

	// TODO: implement warning

	onAtomicStyleAdded(listener: EventHookListener<AddedAtomicStyle>) {
		return this._atomicStyleAddedHook.on(listener)
	}

	globalStyo(cssString: string) {
		const minified = cssString.replace(/\s+/g, ' ').trim()
		if (minified === '')
			return

		this._addedGlobalStyleList.push(minified)
	}

	styo(...itemList: [StyleItem<AliasForNesting, AliasTemplateForNesting, AliasForSelector, AliasTemplateForSelector, Shortcut, ShortcutTemplate>, ...StyleItem<AliasForNesting, AliasTemplateForNesting, AliasForSelector, AliasTemplateForSelector, Shortcut, ShortcutTemplate>[]]) {
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

	renderStyles() {
		const renderedGlobalStyles = this._renderGlobalStyles()
		const renderedAtomicStyles = this._renderAtomicStyles()
		const result = [
			...renderedGlobalStyles === ''
				? []
				: [
						'/* StyoCSS Global Styles Start */',
						renderedGlobalStyles,
						'/* StyoCSS Global Styles End */',
					],
			...renderedAtomicStyles === ''
				? []
				: [
						'/* StyoCSS Atomic Styles Start */',
						renderedAtomicStyles,
						'/* StyoCSS Atomic Styles End */',
					],
		].join('')
		return result
	}
}

function serializeAtomicStyleContentWithoutValue({ nesting, selector, important, property }: AtomicStyleContent) {
	return JSON.stringify([nesting, selector, important, property])
}

function serializeAtomicStyleContent({ nesting, selector, important, property, value }: AtomicStyleContent) {
	return JSON.stringify([nesting, selector, important, property, value])
}

function optimizeAtomicStyleContentList(list: AtomicStyleContent[]) {
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

		// Make the override value to be the last one
		map.delete(key)
		map.set(key, content)
	})
	return [...map.values()]
}

export {
	StyoEngine,
}
