import { error, json } from '@sveltejs/kit';
import { fetchRecent, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const HOUR = 3_600_000;

/** The rain of the days before `today` (the place's date, so the reader's clock does not matter). */
export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const coordinates = roundCoordinates(parsed);
	const today = url.searchParams.get('today') ?? '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(today))) {
		error(400, 'today must be YYYY-MM-DD');
	}

	try {
		const days = await memo(`recent:${coordinates.lat},${coordinates.lon}:${today}`, 6 * HOUR, () =>
			fetchRecent(coordinates, today, fetch)
		);
		// Past days settle within a day as the models' analyses catch up, so hours, not weeks.
		setHeaders({ 'cache-control': 'public, max-age=3600, s-maxage=21600' });
		return json(days);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
