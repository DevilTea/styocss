import { UtilitiesEngine, type EngineWarning, type RegisteredAtomicUtility } from '@styocss/utilities-engine'
import { invoke, isRegExp, numberToAlphabets, toKebab, type EventHookListener } from '@styocss/shared'
import type {
  AtomicUtilitiesDefinition,
  AtomicUtilitiesDefinitionExtractor,
  AtomicUtilityContent,
  AtomicUtilityNameGetter,
  StyoOptions,
  ResolvedStyoOptions,
  MacroUtilityNameOrAtomicUtilitiesDefinition,
  StyoCommonOptions,
  MacroUtilityPartial,
  StyoPreset,
  AtomicUtilitySelector,
} from './types'

export * from './types'

export class StyoInstance<
  NestedWithTemplateName extends string = never,
  SelectorTemplateName extends string = never,
  MacroUtilityNameOrTemplate extends string = never,
> {
  static #resolveStyoOptions (options: StyoOptions): ResolvedStyoOptions {
    const {
      atomicUtilityNamePrefix = '',
      defaultAtomicUtilityNestedWith = '',
      defaultAtomicUtilitySelector = '.{u}',
      defaultAtomicUtilityImportant = false,
      presets,
      ...lastPreset
    } = options

    const baseStyoOptionsList: StyoCommonOptions[] = [...(presets || []), lastPreset]

    const resolvedOptions: ResolvedStyoOptions = {
      atomicUtilityNamePrefix,
      defaultAtomicUtilityNestedWith,
      defaultAtomicUtilitySelector,
      defaultAtomicUtilityImportant,
      macroUtilities: baseStyoOptionsList.flatMap(({ macroUtilities }) => {
        if (macroUtilities == null)
          return []

        return macroUtilities
      }),
    }

    return resolvedOptions
  }

  static #createDefaultAtomicUtilitiesDefinitionExtractor ({
    getEngine,
    defaultNestedWith,
    defaultSelector,
    defaultImportant,
  }: {
    getEngine: () => UtilitiesEngine<AtomicUtilitiesDefinition, AtomicUtilityContent>
    defaultNestedWith: string
    defaultSelector: string
    defaultImportant: boolean
  }) {
    const extractor: AtomicUtilitiesDefinitionExtractor = (atomicUtilitiesDefinition) => {
      const applied = invoke((): AtomicUtilitiesDefinition => {
        const { __apply: toBeAppliedMacros = [] } = atomicUtilitiesDefinition
        if (toBeAppliedMacros.length === 0)
          return {}

        let definition: AtomicUtilitiesDefinition = {}
        getEngine().useUtilities(...(toBeAppliedMacros as [string, ...string[]]))
          .forEach(({ content }) => {
            definition = {
              ...definition,
              __nestedWith: content.nestedWith,
              __selector: content.selector as `${any}{u}${any}`,
              __important: content.important,
              [toKebab(content.property)]: content.value,
            }
          })
        return definition
      })
      const rest = invoke((): AtomicUtilitiesDefinition => {
        const {
          __apply,
          __nestedWith,
          __selector,
          __important,
          ...properties
        } = atomicUtilitiesDefinition

        return {
          __nestedWith,
          __selector,
          __important,
          ...Object.fromEntries(
            Object.entries(properties).map(([property, value]) => [toKebab(property), value]),
          ),
        }
      })

      const {
        __nestedWith: nestedWith = defaultNestedWith,
        __selector: selector = defaultSelector,
        __important: important = defaultImportant,
        ...properties
      } = {
        ...applied,
        ...rest,
      }

      return Object.entries(properties)
        .filter(([_property, value]) => value != null)
        .map(([property, value]) => ({
          nestedWith,
          selector,
          important,
          property,
          value,
        }))
    }

    return extractor
  }

  static #createDefaultAtomicUtilityNameGetter ({
    prefix = '',
  }: {
    prefix?: string
  } = {}) {
    const existedNameMap = new Map<string, string>()
    const getter: AtomicUtilityNameGetter = ({ nestedWith, selector, important, property, value }) => {
      const serializedString = [nestedWith, selector, String(important), property, String(value)].join(',')
      const existedName = existedNameMap.get(serializedString)
      if (existedName != null)
        return existedName

      const num = existedNameMap.size

      const atomicUtilityName = `${prefix}${numberToAlphabets(num)}`
      existedNameMap.set(serializedString, atomicUtilityName)
      return atomicUtilityName
    }

    return getter
  }

  #utilitiesEngine: UtilitiesEngine<AtomicUtilitiesDefinition, AtomicUtilityContent>

  constructor (options: StyoOptions = {}) {
    const {
      atomicUtilityNamePrefix,
      defaultAtomicUtilityNestedWith,
      defaultAtomicUtilitySelector,
      defaultAtomicUtilityImportant,
      macroUtilities: macroUtilityDefinitions,
    } = StyoInstance.#resolveStyoOptions(options)

    this.#utilitiesEngine = new UtilitiesEngine<AtomicUtilitiesDefinition, AtomicUtilityContent>({
      atomicUtilitiesDefinitionExtractor: StyoInstance.#createDefaultAtomicUtilitiesDefinitionExtractor({
        getEngine: () => this.#utilitiesEngine,
        defaultNestedWith: defaultAtomicUtilityNestedWith,
        defaultSelector: defaultAtomicUtilitySelector,
        defaultImportant: defaultAtomicUtilityImportant,
      }),
      atomicUtilityNameGetter: StyoInstance.#createDefaultAtomicUtilityNameGetter({
        prefix: atomicUtilityNamePrefix,
      }),
    })

    this.#utilitiesEngine.addMacroUtilities(macroUtilityDefinitions)
  }

  onAtomicUtilityRegistered (fn: EventHookListener<RegisteredAtomicUtility<AtomicUtilityContent>>) {
    return this.#utilitiesEngine.onAtomicUtilityRegistered(fn)
  }

  onWarned (fn: EventHookListener<EngineWarning>) {
    return this.#utilitiesEngine.onWarned(fn)
  }

  #renderUtilitiesCss (): string {
    return Array.from(this.#utilitiesEngine.registeredAtomicUtilitiesMap.values())
      .map(({ name, content: { nestedWith, selector, property, value, important } }) => {
        const body = `${selector.replaceAll('{u}', name)}{${property}:${value}${important ? ' !important' : ''}}`

        if (nestedWith === '')
          return body

        return `${nestedWith}{${body}}`
      }).join('\n')
  }

  renderCss (): string {
    return `
    /* Utilities */
    ${this.#renderUtilitiesCss()}
    `.trim()
  }

  style (...definitions: [MacroUtilityNameOrAtomicUtilitiesDefinition<NestedWithTemplateName, SelectorTemplateName, MacroUtilityNameOrTemplate>, ...MacroUtilityNameOrAtomicUtilitiesDefinition<NestedWithTemplateName, SelectorTemplateName, MacroUtilityNameOrTemplate>[]]) {
    return this.#utilitiesEngine.useUtilities(...definitions)
      .map(({ name }) => name)
  }
}

export class StyoPresetBuilder<
  NestedWithTemplate extends string = never,
  SelectorTemplate extends string = never,
  MacroUtilityNameOrTemplate extends string = never,
> {
  #preset: StyoPreset

  constructor (name: string) {
    this.#preset = {
      name,
    }
  }

  registerNestedWithTemplates<T extends string[]> (_template: [...T]): StyoPresetBuilder<NestedWithTemplate | T[number], SelectorTemplate, MacroUtilityNameOrTemplate>
  registerNestedWithTemplates<T extends string[]> (..._template: [...T]): StyoPresetBuilder<NestedWithTemplate | T[number], SelectorTemplate, MacroUtilityNameOrTemplate>
  registerNestedWithTemplates<T extends string[]> (..._template: [...T] | [[...T]]): StyoPresetBuilder<NestedWithTemplate | T[number], SelectorTemplate, MacroUtilityNameOrTemplate> {
    return this
  }

  registerSelectorTemplates<T extends string[]> (_template: [...T]): StyoPresetBuilder<NestedWithTemplate, SelectorTemplate | T[number], MacroUtilityNameOrTemplate>
  registerSelectorTemplates<T extends string[]> (..._template: [...T]): StyoPresetBuilder<NestedWithTemplate, SelectorTemplate | T[number], MacroUtilityNameOrTemplate>
  registerSelectorTemplates<T extends string[]> (..._template: [...T] | [[...T]]): StyoPresetBuilder<NestedWithTemplate, SelectorTemplate | T[number], MacroUtilityNameOrTemplate> {
    return this
  }

  registerMacroUtility<N extends string>(name: N, partials: MacroUtilityPartial<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate>[]): StyoPresetBuilder<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate | N>
  registerMacroUtility<T extends string>(pattern: RegExp, createPartials: (matched: string[]) => (MacroUtilityPartial<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate>)[], template?: T): StyoPresetBuilder<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate | T>
  registerMacroUtility (...args: [name: string, partials: MacroUtilityPartial[]] | [pattern: RegExp, createPartials: (matched: string[]) => MacroUtilityPartial[], template?: string]) {
    if (this.#preset.macroUtilities == null)
      this.#preset.macroUtilities = []

    if (typeof args[0] === 'string' && Array.isArray(args[1])) {
      const [name, partials] = args
      this.#preset.macroUtilities.push({ name, partials })
    } else if (isRegExp(args[0]) && typeof args[1] === 'function') {
      const [pattern, createPartials] = args
      this.#preset.macroUtilities.push({ pattern, createPartials })
    }

    return this
  }

  done (): StyoPreset<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate> {
    return this.#preset
  }
}

export class StyoInstanceBuilder<
  NestedWithTemplate extends string = never,
  SelectorTemplate extends string = never,
  MacroUtilityNameOrTemplate extends string = never,
> {
  #styoOptions: StyoOptions = {}

  setAtomicUtilityNamePrefix (prefix: string) {
    this.#styoOptions.atomicUtilityNamePrefix = prefix
    return this
  }

  setDefaultAtomicUtilityNestedWith (nestedWith: string) {
    this.#styoOptions.defaultAtomicUtilityNestedWith = nestedWith
    return this
  }

  setDefaultAtomicUtilitySelector (selector: AtomicUtilitySelector) {
    this.#styoOptions.defaultAtomicUtilitySelector = selector
    return this
  }

  setDefaultAtomicUtilityImportant (important: boolean) {
    this.#styoOptions.defaultAtomicUtilityImportant = important
    return this
  }

  usePreset<NestedWithTemplateNameFromPreset extends string, SelectorTemplateNameFromPreset extends string, MacroUtilityNameOrTemplateFromPreset extends string>(
    preset: StyoPreset<NestedWithTemplateNameFromPreset, SelectorTemplateNameFromPreset, MacroUtilityNameOrTemplateFromPreset>,
  ): StyoInstanceBuilder<NestedWithTemplate | NestedWithTemplateNameFromPreset, SelectorTemplate | SelectorTemplateNameFromPreset, MacroUtilityNameOrTemplate | MacroUtilityNameOrTemplateFromPreset> {
    if (this.#styoOptions.presets == null)
      this.#styoOptions.presets = []

    this.#styoOptions.presets.push(preset)
    return this
  }

  registerNestedWithTemplates<T extends string[]> (_template: [...T]): StyoInstanceBuilder<NestedWithTemplate | T[number], SelectorTemplate, MacroUtilityNameOrTemplate>
  registerNestedWithTemplates<T extends string[]> (..._template: [...T]): StyoInstanceBuilder<NestedWithTemplate | T[number], SelectorTemplate, MacroUtilityNameOrTemplate>
  registerNestedWithTemplates<T extends string[]> (..._template: [...T] | [[...T]]): StyoInstanceBuilder<NestedWithTemplate | T[number], SelectorTemplate, MacroUtilityNameOrTemplate> {
    return this
  }

  registerSelectorTemplates<T extends string[]> (_template: [...T]): StyoInstanceBuilder<NestedWithTemplate, SelectorTemplate | T[number], MacroUtilityNameOrTemplate>
  registerSelectorTemplates<T extends string[]> (..._template: [...T]): StyoInstanceBuilder<NestedWithTemplate, SelectorTemplate | T[number], MacroUtilityNameOrTemplate>
  registerSelectorTemplates<T extends string[]> (..._template: [...T] | [[...T]]): StyoInstanceBuilder<NestedWithTemplate, SelectorTemplate | T[number], MacroUtilityNameOrTemplate> {
    return this
  }

  registerMacroUtility<N extends string>(name: N, partials: MacroUtilityPartial<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate>[]): StyoInstanceBuilder<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate | N>
  registerMacroUtility<T extends string>(pattern: RegExp, createPartials: (matched: string[]) => (MacroUtilityPartial<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate>)[], template?: T): StyoInstanceBuilder<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate | T>
  registerMacroUtility (...args: [name: string, partials: MacroUtilityPartial<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate>[]] | [pattern: RegExp, createPartials: (matched: string[]) => MacroUtilityPartial<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate>[], template?: string]) {
    if (this.#styoOptions.macroUtilities == null)
      this.#styoOptions.macroUtilities = []

    if (typeof args[0] === 'string' && Array.isArray(args[1])) {
      const [name, partials] = args
      this.#styoOptions.macroUtilities.push({ name, partials })
    } else if (isRegExp(args[0]) && typeof args[1] === 'function') {
      const [pattern, createPartials] = args
      this.#styoOptions.macroUtilities.push({ pattern, createPartials })
    }

    return this
  }

  done (): StyoInstance<NestedWithTemplate, SelectorTemplate, MacroUtilityNameOrTemplate> {
    return new StyoInstance(this.#styoOptions)
  }
}

export function createStyoPreset (name: string) {
  return new StyoPresetBuilder(name)
}

export function createStyoInstance () {
  return new StyoInstanceBuilder()
}
