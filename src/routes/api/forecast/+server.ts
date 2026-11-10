import { error, json } from '@sveltejs/kit';
import { fetchForecast, WeatherServiceError } from '#lib/server/open-meteo.js';
import { parseCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const coordinates = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!coordinates) error(400, 'lat and lon must be valid coordinates');

	try {
		const forecast = await fetchForecast(coordinates, fetch);
		// Open-Meteo updates hourly; 15 minutes keeps "now" fresh while the CDN absorbs repeats.
		setHeaders({
			'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=600'
		});
		return json(forecast);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
