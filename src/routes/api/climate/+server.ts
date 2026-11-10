import { error, json } from '@sveltejs/kit';
import { fetchClimate, WeatherServiceError } from '#lib/server/open-meteo.js';
import { parseCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const coordinates = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!coordinates) error(400, 'lat and lon must be valid coordinates');
	const month = url.searchParams.get('month') ?? '';
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) error(400, 'month must be YYYY-MM');

	try {
		const climate = await fetchClimate(coordinates, month, fetch);
		// The past does not change: one archive request per place and month, then the CDN answers.
		setHeaders({ 'cache-control': 'public, max-age=86400, s-maxage=2592000' });
		return json(climate);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
