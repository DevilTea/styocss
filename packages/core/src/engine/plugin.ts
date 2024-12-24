import type { Arrayable, Awaitable, _StyleDefinition, _StyleItem } from '../types'
import type { EngineConfig, ResolvedEngineConfig } from '../config'

type DefineHooks<Hooks extends Record<string, [type: 'sync' | 'async', payload: any]>> = Hooks

type EngineHooksDefinition = DefineHooks<{
	config: ['async', EngineConfig]
	configResolved: ['async', ResolvedEngineConfig]
	transformSelectors: ['async', string[]]
	transformStyleItems: ['async', _StyleItem[]]
	transformStyleDefinitions: ['async', _StyleDefinition[]]
	atomicRuleAdded: ['sync', void]
}>

async function execAsyncHook(plugins: any[], hook: string, payload: any) {
	for (const plugin of plugins) {
		if (plugin[hook] == null)
			continue

		const newPayload = await plugin[hook](payload)
		if (newPayload != null)
			payload = newPayload
	}
	return payload
}

function execSyncHook(plugins: any[], hook: string, payload: any) {
	for (const plugin of plugins) {
		if (plugin[hook] == null)
			continue

		const newPayload = plugin[hook](payload)
		if (newPayload != null)
			payload = newPayload
	}
	return payload
}

type EngineHooks = {
	[K in keyof EngineHooksDefinition]: (
		plugins: ResolvedEnginePlugin[],
		...params: EngineHooksDefinition[K][1] extends void ? [] : [payload: EngineHooksDefinition[K][1]]
	) => EngineHooksDefinition[K][0] extends 'async' ? Promise<EngineHooksDefinition[K][1]> : EngineHooksDefinition
}

export const hooks: EngineHooks = {
	config: (plugins: ResolvedEnginePlugin[], config: EngineConfig) =>
		execAsyncHook(plugins, 'config', config),
	configResolved: (plugins: ResolvedEnginePlugin[], resolvedConfig: ResolvedEngineConfig) =>
		execAsyncHook(plugins, 'configResolved', resolvedConfig),
	transformSelectors: (plugins: ResolvedEnginePlugin[], selectors: string[]) =>
		execAsyncHook(plugins, 'transformSelectors', selectors),
	transformStyleItems: (plugins: ResolvedEnginePlugin[], styleItems: _StyleItem[]) =>
		execAsyncHook(plugins, 'transformStyleItems', styleItems),
	transformStyleDefinitions: (plugins: ResolvedEnginePlugin[], styleDefinitions: _StyleDefinition[]) =>
		execAsyncHook(plugins, 'transformStyleDefinitions', styleDefinitions),
	atomicRuleAdded: (plugins: ResolvedEnginePlugin[]) =>
		execSyncHook(plugins, 'atomicRuleAdded', undefined),
}

type EnginePluginHooksOptions = {
	[K in keyof EngineHooksDefinition]?: EngineHooksDefinition[K][0] extends 'async'
		? (...params: EngineHooksDefinition[K][1] extends void ? [] : [payload: EngineHooksDefinition[K][1]]) => Awaitable<EngineHooksDefinition[K][1] | void>
		: (...params: EngineHooksDefinition[K][1] extends void ? [] : [payload: EngineHooksDefinition[K][1]]) => EngineHooksDefinition[K][1] | void
}

export interface ResolvedEnginePlugin extends EnginePluginHooksOptions {
	name: string
	enforce?: 'pre' | 'post'
	/**
	 * **Note:** This is a type only field and will not be used by the engine.
	 */
	customConfigType?: Record<string, any>
}

export type EnginePlugin = Awaitable<Arrayable<ResolvedEnginePlugin>>

export type ResolveEnginePlugins<List extends EnginePlugin[]> = List extends [infer Plugin extends EnginePlugin, ...infer Rest extends EnginePlugin[]]
	? Plugin extends ResolvedEnginePlugin
		? [Plugin, ...ResolveEnginePlugins<Rest>]
		: Plugin extends ResolvedEnginePlugin[]
			? [...Plugin, ...ResolveEnginePlugins<Rest>]
			: [...ResolveEnginePlugins<[Awaited<Plugin>]>, ...ResolveEnginePlugins<Rest>]
	: []

const orderMap = new Map([
	[undefined, 1],
	['pre', 0],
	['post', 2],
])
export async function resolvePlugins(plugins: EnginePlugin[]) {
	const result: ResolvedEnginePlugin[] = []
	for (const plugin of plugins)
		result.push(...[await plugin].flat())

	return result.sort((a, b) => orderMap.get(a.enforce)! - orderMap.get(b.enforce)!)
}
