import { error, json } from '@sveltejs/kit';
import { fetchModels, WeatherServiceError } from '#lib/server/open-meteo.js';
import { parseCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const coordinates = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!coordinates) error(400, 'lat and lon must be valid coordinates');

	try {
		const runs = await fetchModels(coordinates, fetch);
		setHeaders({
			'cache-control':
				'public, max-age=300, s-maxage=900, stale-while-revalidate=600, stale-if-error=86400'
		});
		return json(runs);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
