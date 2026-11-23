import { error, json } from '@sveltejs/kit';
import {
	countryAt,
	demoScenarios,
	fetchForecast,
	fetchHolidays,
	WeatherServiceError,
	type DemoScenario
} from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { skyEvents } from '#lib/server/sky.js';
import { auroraTonight, fetchKp } from '#lib/server/aurora.js';
import { holidaysWithin, languagesOf, type PlaceHolidays } from '#lib/holidays.js';
import { parseCoordinates, roundCoordinates, type Coordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * The public holidays of the place's country (F-26), this year and the next from December. The
 * country is looked up at about 10 km, so more places share one Nominatim request; a place right
 * on a border may get its neighbour's holidays. Slow or failed lookups give none rather than
 * holding up the forecast.
 */
async function placeHolidays(coordinates: Coordinates, fetchFn: typeof fetch) {
	const area = {
		lat: Math.round(coordinates.lat * 10) / 10,
		lon: Math.round(coordinates.lon * 10) / 10
	};
	const lookup = (async () => {
		const country = await memo(`country:${area.lat},${area.lon}`, 30 * DAY, () =>
			countryAt(area, fetchFn)
		);
		if (!country) return null;
		const now = new Date();
		const years = [
			now.getUTCFullYear(),
			...(now.getUTCMonth() === 11 ? [now.getUTCFullYear() + 1] : [])
		];
		const lists = await Promise.all(
			years.map((year) =>
				memo(`holidays:${country}:${year}`, 30 * DAY, () => fetchHolidays(country, year, fetchFn))
			)
		);
		return { country, list: lists.flat() };
	})().catch(() => null);
	const timeout = new Promise<null>((done) => setTimeout(() => done(null), 1500));
	return Promise.race([lookup, timeout]);
}

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const coordinates = roundCoordinates(parsed);

	// Only honoured with fixtures on (fetchForecast checks), so production ignores it.
	const demoParam = url.searchParams.get('demo');
	const demo = demoScenarios.find((d) => d === demoParam) as DemoScenario | undefined;

	const holidaysLookup = placeHolidays(coordinates, fetch);
	try {
		// The health check shares this cache entry, so the moon is added after it, not inside it.
		const forecast = await memo(
			`forecast:${coordinates.lat},${coordinates.lon}:${demo ?? ''}`,
			10 * MINUTE,
			() => fetchForecast(coordinates, fetch, demo)
		);
		const { time } = forecast.current;
		// One NOAA forecast serves every place. Failures are not kept, and without it there is
		// simply no aurora line.
		const kp = await memo('kp', HOUR, () => fetchKp(fetch)).catch(() => []);
		const sky = {
			...skyEvents(coordinates, time, forecast.utcOffsetSeconds),
			aurora: auroraTonight(kp, coordinates, time, forecast.utcOffsetSeconds)
		};
		const found = await holidaysLookup;
		const holidays: PlaceHolidays | null = found && {
			languages: languagesOf(found.country),
			days: holidaysWithin(found.list, forecast.days[0].date, forecast.days.length)
		};
		// Open-Meteo updates hourly; 15 minutes keeps "now" fresh while the CDN absorbs repeats.
		setHeaders({
			'cache-control':
				'public, max-age=300, s-maxage=900, stale-while-revalidate=600, stale-if-error=86400'
		});
		return json({ ...forecast, sky, ...(holidays && { holidays }) });
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
