import * as prettier from 'prettier'
import type { IntegrationContext } from './types'

function formatUnionType(types: string[]) {
	return types.length > 0 ? types.join(' | ') : 'never'
}

async function generateOverloadContent(ctx: IntegrationContext) {
	const paramsLines: string[] = []
	const fnsLines: string[] = []
	const usages = [...ctx.usages.values()].flat().filter(u => u.isPreview)

	for (let i = 0; i < usages.length; i++) {
		const usage = usages[i]!
		paramsLines.push(
			...usage.params.map((param, index) => `type P${i}_${index} = ${JSON.stringify(param)}`),
		)
		fnsLines.push(...[
			'  /**',
			'   * ### StyoCSS Preview',
			'   * ```css',
			// CSS Lines
			...(await prettier.format(ctx.engine.previewStyles(...usage.params), { parser: 'css' }))
				.split('\n')
				.map(line => `   * ‎${line.replace(/^(\s*)/, '$1‎')}`),
			'   * ```',
			'   */',
			`  fn(...params: [${usage.params.map((_, index) => `p${index}: P${i}_${index}`).join(', ')}]): ReturnType<StyoFn>`,
		])
	}

	return [
		'interface PreviewOverloads<StyoFn extends (StyoFn_Array | StyoFn_String | StyoFn_Inline)> {',
		...fnsLines,
		'  /**',
		'   * StyoCSS Preview',
		'   * Save the current file to see the preview.',
		'   */',
		`  fn(...params: Parameters<StyoFn>): ReturnType<StyoFn>`,
		'}',
		...paramsLines,
	]
}

export async function generateDtsContent(ctx: IntegrationContext) {
	const {
		engine,
		transformedFormat,
		fnName: styoFnName,
		previewEnabled,
		hasVue,
	} = ctx
	const aliasForSelectorList = [
		...engine.selectorResolver.staticRules.map(({ string }) => string),
		...engine.selectorResolver.dynamicRules.flatMap(({ predefined }) => predefined),
	].map(alias => `'${alias}'`)
	const shortcutList = [
		...engine.shortcutResolver.staticRules.map(({ string }) => string),
		...engine.shortcutResolver.dynamicRules.flatMap(({ predefined }) => predefined),
	].map(name => `'${name}'`)

	const lines = []
	lines.push(...[
		`// Auto-generated by ${ctx.currentPackageName}`,
		`import type { Engine } from \'${ctx.currentPackageName}\'`,
		'',
		'type _StyoFn = Engine<',
		`  /* Selector */ ${formatUnionType(aliasForSelectorList)},`,
		`  /* Shortcut */ ${formatUnionType(shortcutList)}`,
		'>[\'use\']',
		'',
	])

	if (transformedFormat === 'array') {
		lines.push(...[
			'type StyoFn_Normal = StyoFn_Array',
		])
	}
	else if (transformedFormat === 'string') {
		lines.push(...[
			'type StyoFn_Normal = StyoFn_String',
		])
	}
	else if (transformedFormat === 'inline') {
		lines.push(...[
			'type StyoFn_Normal = StyoFn_Inline',
		])
	}
	lines.push(...[
		'type StyoFn_Array = (...params: Parameters<_StyoFn>) => string[]',
		'type StyoFn_String = (...params: Parameters<_StyoFn>) => string',
		'type StyoFn_Inline = (...params: Parameters<_StyoFn>) => void',
		'',
		`type Styo = ${previewEnabled ? 'PreviewOverloads<StyoFn_Normal>[\'fn\']' : 'StyoFn_Normal'} & {`,
		`  str: ${previewEnabled ? 'PreviewOverloads<StyoFn_String>[\'fn\']' : 'StyoFn_String'}`,
		`  arr: ${previewEnabled ? 'PreviewOverloads<StyoFn_Array>[\'fn\']' : 'StyoFn_Array'}`,
		`  inl: ${previewEnabled ? 'PreviewOverloads<StyoFn_Inline>[\'fn\']' : 'StyoFn_Inline'}`,
		'}',
	])

	lines.push(...[
		'declare global {',
		'  /**',
		'   * StyoCSS',
		'   */',
		`  const ${styoFnName}: Styo`,
		'}',
		'',
	])

	if (hasVue) {
		lines.push(...[
			'declare module \'vue\' {',
			'  interface ComponentCustomProperties {',
			'    /**',
			'     * StyoCSS',
			'     */',
			`    ${styoFnName}: Styo`,
			'  }',
			'}',
			'',
		])
	}

	if (previewEnabled)
		lines.push(...await generateOverloadContent(ctx))

	return lines.join('\n')
}
