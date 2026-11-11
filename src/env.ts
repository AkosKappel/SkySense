import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	SKYSENSE_FIXTURES: {
		description:
			'Set to 1 to answer with the recorded Open-Meteo responses in src/lib/server/fixtures (tests, demos).',
		schema: (value) => value === '1'
	},
	CARTO_BASEMAP_KEY: {
		description:
			'Free key for CARTO raster basemaps (carto.com/basemaps/apikey), for the radar map. Public: it ends up in tile URLs; restrict it to the site in the CARTO dashboard. Without it the radar shows on a plain background.',
		public: true,
		schema: (value) => value || undefined
	}
});
