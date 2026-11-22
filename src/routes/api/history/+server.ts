import { error, json } from '@sveltejs/kit';
import { fetchHistory, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { FIRST_DAY } from '#lib/history.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const coordinates = roundCoordinates(parsed);
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	if (!isDate(from) || !isDate(to)) error(400, 'from and to must be YYYY-MM-DD');
	// A year at most keeps each archive request light (a few calls against Open-Meteo's limits).
	const days = (Date.parse(to) - Date.parse(from)) / DAY;
	if (from < FIRST_DAY || days < 0 || days > 365) error(400, 'from to to must be a year at most');

	try {
		const history = await memo(
			`history:${coordinates.lat},${coordinates.lon}:${from}:${to}`,
			6 * HOUR,
			() => fetchHistory(coordinates, from, to, fetch)
		);
		// The past does not change, but ERA5 runs about five days behind: a period that has not
		// reached `to` yet is cached for hours, not a month.
		const complete = history.at(-1)?.date === to;
		setHeaders({
			'cache-control': complete
				? 'public, max-age=86400, s-maxage=2592000'
				: 'public, max-age=3600, s-maxage=21600'
		});
		return json(history);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
