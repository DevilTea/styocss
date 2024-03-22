import { createHash } from 'node:crypto'
import type { Plugin as VitePlugin } from 'vite'
import type { StyoPluginContext } from './shared'
import { createFunctionCallTransformer, resolveId } from './shared'
import { CSS_CONTENT_PLACEHOLDER, PLUGIN_NAME_BUILD_GENERATE, PLUGIN_NAME_BUILD_PREPARE } from './constants'

function getHash(input: string, length = 8) {
	return createHash('sha256')
		.update(input)
		.digest('hex')
		.slice(0, length)
}

export function createBuildPlugins(ctx: StyoPluginContext): VitePlugin[] {
	return [
		{
			name: PLUGIN_NAME_BUILD_PREPARE,
			enforce: 'pre',
			apply: 'build',
			resolveId(id) {
				return resolveId(id)
			},
			load(id) {
				if (resolveId(id))
					return CSS_CONTENT_PLACEHOLDER

				return null
			},
			transform: createFunctionCallTransformer(ctx),
		},
		{
			name: PLUGIN_NAME_BUILD_GENERATE,
			enforce: 'post',
			apply: 'build',
			generateBundle(_, bundle) {
				const css = ctx.engine.renderStyles().replace(/\n/g, '')
				Object.values(bundle).forEach(async (chunk) => {
					if (chunk.type === 'asset' && typeof chunk.source === 'string' && chunk.source.includes(CSS_CONTENT_PLACEHOLDER)) {
						chunk.source = chunk.source.replace(CSS_CONTENT_PLACEHOLDER, css)
						const hash = getHash(chunk.source)
						chunk.fileName = chunk.fileName.replace(/\.css$/, `.styo-${hash}.css`)
					}
				})
			},
		},
	]
}
