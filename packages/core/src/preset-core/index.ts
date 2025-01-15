import { defineEnginePreset } from '../engine/preset'
import { important } from './plugins/important'
import { keyframes } from './plugins/keyframes'
import { selectors } from './plugins/selectors'
import { shortcuts } from './plugins/shortcuts'
import { variables } from './plugins/variables'

function core() {
	return defineEnginePreset({
		name: 'core',
		plugins: [
			important(),
			variables(),
			keyframes(),
			selectors(),
			shortcuts(),
		],
	})
}
