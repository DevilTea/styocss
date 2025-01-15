import type { EnginePlugin } from '../engine'
import type { AutocompleteConfig, PreflightConfig, PreflightFn, ResolvedAutocompleteConfig } from '../types'

export interface EngineConfig {
	/**
	 * Prefix for atomic style name.
	 *
	 * @default ''
	 */
	prefix?: string
	/**
	 * Default value for `$selector` property. (`'$'` will be replaced with the atomic style name.)
	 *
	 * @example '.$' - Usage in class attribute: `<div class="a b c">`
	 * @example '[data-styo="$"]' - Usage in attribute selector: `<div data-styo="a b c">`
	 * @default '.$'
	 */
	defaultSelector?: string

	/**
	 * Define styles that will be injected globally.
	 */
	preflights?: PreflightConfig[]

	autocomplete?: AutocompleteConfig

	/**
	 * Custom configuration.
	 */
	[K: string]: any
}

export interface ResolvedCommonConfig {
	preflights: PreflightFn[]
	autocomplete: ResolvedAutocompleteConfig
}

export interface ResolvedEngineConfig {
	rawConfig: EngineConfig
	prefix: string
	defaultSelector: string
	preflights: PreflightFn[]
	autocomplete: ResolvedAutocompleteConfig
	plugins: EnginePlugin[]
}
