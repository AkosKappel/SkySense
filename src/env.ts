import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	SKYSENSE_FIXTURES: {
		description:
			'Set to 1 to answer with the recorded Open-Meteo responses in src/lib/server/fixtures (tests, demos).',
		schema: (value) => value === '1'
	}
});
