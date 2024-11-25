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
			'   * StyoCSS Preview',
			'   * ```css',
			// CSS Lines
			...(await prettier.format(ctx.engine.previewStyles(...usage.params), { parser: 'css' }))
				.split('\n')
				.map(line => `   * ‎${line}`),
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
		styoFnNames,
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
		`import type { StyoEngine } from \'${ctx.currentPackageName}\'`,
		'',
		'type _StyoFn = StyoEngine<',
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
	])

	lines.push(...[
		'declare global {',
		'  /**',
		'   * StyoCSS',
		`   * If you want to see the preview, use \`${styoFnNames.normalPreview}()\` instead.`,
		'   */',
		`  const ${styoFnNames.normal}: StyoFn_Normal`,
		`  const ${styoFnNames.normalPreview}: PreviewOverloads<StyoFn_Normal>['fn']`,
		'  /**',
		'   * StyoCSS',
		`   * If you want to see the preview, use \`${styoFnNames.forceStringPreview}()\` instead.`,
		'   */',
		`  const ${styoFnNames.forceString}: StyoFn_String`,
		`  const ${styoFnNames.forceStringPreview}: PreviewOverloads<StyoFn_String>['fn']`,
		'  /**',
		'   * StyoCSS',
		`   * If you want to see the preview, use \`${styoFnNames.forceArrayPreview}()\` instead.`,
		'   */',
		`  const ${styoFnNames.forceArray}: StyoFn_Array`,
		`  const ${styoFnNames.forceArrayPreview}: PreviewOverloads<StyoFn_Array>['fn']`,
		'  /**',
		'   * StyoCSS',
		`   * If you want to see the preview, use \`${styoFnNames.forceInlinePreview}()\` instead.`,
		'   */',
		`  const ${styoFnNames.forceInline}: StyoFn_Inline`,
		`  const ${styoFnNames.forceInlinePreview}: PreviewOverloads<StyoFn_Inline>['fn']`,
		'}',
		'',
	])

	if (hasVue) {
		lines.push(...[
			'declare module \'vue\' {',
			'  interface ComponentCustomProperties {',
			'    /**',
			'     * StyoCSS',
			`     * If you want to see the preview, use \`${styoFnNames.normalPreview}()\` instead.`,
			'     */',
			`    ${styoFnNames.normal}: StyoFn_Normal`,
			`    ${styoFnNames.normalPreview}: PreviewOverloads<StyoFn_Normal>['fn']`,
			'    /**',
			'     * StyoCSS',
			`     * If you want to see the preview, use \`${styoFnNames.forceStringPreview}()\` instead.`,
			'     */',
			`    ${styoFnNames.forceString}: StyoFn_String`,
			`    ${styoFnNames.forceStringPreview}: PreviewOverloads<StyoFn_String>['fn']`,
			'    /**',
			'     * StyoCSS',
			`     * If you want to see the preview, use \`${styoFnNames.forceArrayPreview}()\` instead.`,
			'     */',
			`    ${styoFnNames.forceArray}: StyoFn_Array`,
			`    ${styoFnNames.forceArrayPreview}: PreviewOverloads<StyoFn_Array>['fn']`,
			'    /**',
			'     * StyoCSS',
			`     * If you want to see the preview, use \`${styoFnNames.forceInlinePreview}()\` instead.`,
			'     */',
			`    ${styoFnNames.forceInline}: StyoFn_Inline`,
			`    ${styoFnNames.forceInlinePreview}: PreviewOverloads<StyoFn_Inline>['fn']`,
			'  }',
			'}',
			'',
		])
	}

	lines.push(...await generateOverloadContent(ctx))

	return lines.join('\n')
}
