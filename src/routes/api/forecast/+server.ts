import { error, json } from '@sveltejs/kit';
import { fetchForecast, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const MINUTE = 60_000;

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const coordinates = roundCoordinates(parsed);

	try {
		const forecast = await memo(`forecast:${coordinates.lat},${coordinates.lon}`, 10 * MINUTE, () =>
			fetchForecast(coordinates, fetch)
		);
		// Open-Meteo updates hourly; 15 minutes keeps "now" fresh while the CDN absorbs repeats.
		setHeaders({
			'cache-control':
				'public, max-age=300, s-maxage=900, stale-while-revalidate=600, stale-if-error=86400'
		});
		return json(forecast);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
