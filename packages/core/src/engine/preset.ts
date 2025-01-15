import type { AutocompleteConfig, PreflightConfig } from '../types'
import type { EnginePlugin } from './plugin'

export interface EnginePreset {
	name: string
	/**
	 * Define styles that will be injected globally.
	 */
	preflights?: PreflightConfig[]

	autocomplete?: AutocompleteConfig

	presets?: EnginePreset[]
	plugins?: EnginePlugin[]

	/**
	 * Custom configuration.
	 */
	[K: string]: unknown
}

export function defineEnginePreset<
	Presets extends EnginePreset[] = [],
	Plugins extends EnginePlugin[] = [],
	Preset extends EnginePreset<Presets, Plugins> = EnginePreset<Presets, Plugins>,
>(preset: Preset) {
	return preset
}
