import { error, json } from '@sveltejs/kit';
import { fetchYear, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const HOUR = 3_600_000;

/** "2026-11" gives "2026-10-31". */
function lastDayBefore(month: string): string {
	const day = new Date(`${month}-01T00:00:00Z`);
	day.setUTCDate(0);
	return day.toISOString().slice(0, 10);
}

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const coordinates = roundCoordinates(parsed);
	const month = url.searchParams.get('month') ?? '';
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) error(400, 'month must be YYYY-MM');

	try {
		const year = await memo(`year:${coordinates.lat},${coordinates.lon}:${month}`, 6 * HOUR, () =>
			fetchYear(coordinates, month, fetch)
		);
		// The past does not change, but ERA5 runs about five days behind: early in a month the last
		// days of the year are not there yet, so an incomplete year is cached for hours, not a month.
		const complete = year?.until === lastDayBefore(month);
		setHeaders({
			'cache-control': complete
				? 'public, max-age=86400, s-maxage=2592000'
				: 'public, max-age=3600, s-maxage=21600'
		});
		return json(year);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
