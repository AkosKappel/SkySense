import { error, json } from '@sveltejs/kit';
import { fetchYear, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const DAY = 86_400_000;

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const coordinates = roundCoordinates(parsed);
	const month = url.searchParams.get('month') ?? '';
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) error(400, 'month must be YYYY-MM');

	try {
		const year = await memo(`year:${coordinates.lat},${coordinates.lon}:${month}`, DAY, () =>
			fetchYear(coordinates, month, fetch)
		);
		// The past does not change: one archive request per place and month, then the CDN answers.
		setHeaders({ 'cache-control': 'public, max-age=86400, s-maxage=2592000' });
		return json(year);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
