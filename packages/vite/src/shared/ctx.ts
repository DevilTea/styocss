import { writeFile } from 'node:fs/promises'
import { createStyoEngine } from '@styocss/core'
import { VIRTUAL_STYO_CSS_ID } from '../constants'
import type { StyoPluginContext, StyoPluginOptions } from './types'
import { generateDtsContent } from './dtsGenerator'

const defaultTransformTsToJsFn: NonNullable<StyoPluginOptions['transformTsToJs']> = tsCode => tsCode

export function resolveId(id: string) {
	if (id === VIRTUAL_STYO_CSS_ID)
		return id

	return null
}

export function createCtx(options?: StyoPluginOptions) {
	const {
		extensions = ['.vue', '.tsx', '.jsx'],
		config,
		nameOfStyoFn = 'styo',
		autoJoin = false,
		dts = false,
		transformTsToJs = defaultTransformTsToJsFn,
	} = options || {}

	const ctx: StyoPluginContext = {
		engine: createStyoEngine(config),
		needToTransform(id) {
			return extensions.some(ext => id.endsWith(ext))
		},
		nameOfStyoFn,
		autoJoin,
		dts: dts === true ? 'styo.d.ts' : dts,
		usages: new Map(),
		resolvedDtsPath: null,
		hasVue: false,
		async generateDts() {
			if (
				this.dts === false
				|| this.resolvedDtsPath === null
			) {
				return
			}

			const dtsContent = await generateDtsContent(this)
			await writeFile(this.resolvedDtsPath, dtsContent)
		},
		transformTsToJs,
	}

	return ctx
}