import { error, json } from '@sveltejs/kit';
import { fetchArea, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const HOUR = 3_600_000;

/** A day of hourly weather on a grid around a place, for "where is the weather better?" (M-10). */
export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const date = url.searchParams.get('date') ?? '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error(400, 'date must be YYYY-MM-DD');
	const coordinates = roundCoordinates(parsed);

	try {
		// Forty-nine points count as many calls against Open-Meteo's daily limit, so an hour's cache.
		const cells = await memo(`area:${coordinates.lat},${coordinates.lon}:${date}`, HOUR, () =>
			fetchArea(coordinates, date, fetch)
		);
		setHeaders({
			'cache-control':
				'public, max-age=900, s-maxage=3600, stale-while-revalidate=1800, stale-if-error=86400'
		});
		return json(cells);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
