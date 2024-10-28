import * as prettier from 'prettier'
import type { StyoEngine } from '@styocss/core'
import type { StyoPluginContext } from './types'

function formatUnionType(types: string[]) {
	return types.length > 0 ? types.join(' | ') : 'never'
}

async function generateStyoFnOverload(
	ctx: StyoPluginContext,
	params: (Parameters<StyoEngine['styo']>),
) {
	const prettified = await prettier.format(ctx.engine.previewStyo(...params), { parser: 'css' })
	return [
		'  /**',
		'   * StyoCSS Preview',
		'   * ```css',
		...prettified.split('\n').map(line => `   * ‎${line}`),
		'   * ```',
		'   */',
		`  fn(...params: ${JSON.stringify(params)}): ReturnType<StyoFn>`,
	]
}

export async function generateDtsContent(ctx: StyoPluginContext) {
	const {
		engine,
		transformedFormat,
		styoFnNames,
		usages,
		hasVue,
	} = ctx
	const aliasForNestingList = [
		...engine.staticAliasForNestingRuleList.map(({ alias }) => alias),
		...engine.dynamicAliasForNestingRuleList.flatMap(({ predefined }) => predefined),
	].map(alias => `'${alias}'`)
	const aliasForSelectorList = [
		...engine.staticAliasForSelectorRuleList.map(({ alias }) => alias),
		...engine.dynamicAliasForSelectorRuleList.flatMap(({ predefined }) => predefined),
	].map(alias => `'${alias}'`)
	const shortcutList = [
		...engine.staticShortcutRuleList.map(({ name }) => name),
		...engine.dynamicShortcutRuleList.flatMap(({ predefined }) => predefined),
	].map(name => `'${name}'`)

	const lines = []
	lines.push(...[
		`// Auto-generated by ${ctx.currentPackageName}`,
		`import type { StyoEngine } from \'${ctx.currentPackageName}\'`,
		'',
		'type _StyoFn = StyoEngine<',
		`  /* AliasForNesting */ ${formatUnionType(aliasForNestingList)},`,
		`  /* AliasForSelector */ ${formatUnionType(aliasForSelectorList)},`,
		`  /* Shortcut */ ${formatUnionType(shortcutList)}`,
		'>[\'styo\']',
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
		`   * If you want to see the preview, use \`${styoFnNames.normalpreview}()\` instead.`,
		'   */',
		`  const ${styoFnNames.normal}: StyoFn_Normal`,
		`  const ${styoFnNames.normalpreview}: PreviewOverloads<Styo_Normal>['fn']`,
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
			`     * If you want to see the preview, use \`${styoFnNames.normalpreview}()\` instead.`,
			'     */',
			`    ${styoFnNames.normal}: StyoFn_Normal`,
			`    ${styoFnNames.normalpreview}: PreviewOverloads<Styo_Normal>['fn']`,
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

	lines.push(...[
		'interface PreviewOverloads<StyoFn extends (StyoFn_Array | StyoFn_String | StyoFn_Inline)> {',
	])
	lines.push(
		...(await Promise.all([...usages.values()].flat().map(params => generateStyoFnOverload(ctx, params))))
			.flat(),
	)

	lines.push(...[
		'  /**',
		'   * StyoCSS Preview',
		'   * Save the current file to see the preview.',
		'   */',
		`  fn(...params: Parameters<StyoFn>): ReturnType<StyoFn>`,
		'',
	])
	lines.push(...[
		'}',
	])

	return lines.join('\n')
}
