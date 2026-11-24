import { error, json } from '@sveltejs/kit';
import {
	countryAt,
	demoScenarios,
	fetchForecast,
	fetchHolidays,
	fetchMarine,
	fetchNowcast,
	WeatherServiceError,
	type DemoScenario
} from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { skyEvents } from '#lib/server/sky.js';
import { auroraTonight, fetchKp } from '#lib/server/aurora.js';
import { holidaysWithin, languagesOf, type PlaceHolidays } from '#lib/holidays.js';
import { seaToday } from '#lib/sea.js';
import { parseCoordinates, roundCoordinates, type Coordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Extras around the forecast give up after this, or on failure, rather than hold it up. */
function optional<T>(work: Promise<T>): Promise<T | null> {
	const timeout = new Promise<null>((done) => setTimeout(() => done(null), 1500));
	return Promise.race([work.catch(() => null), timeout]);
}

/**
 * The public holidays of the place's country (F-26), this year and the next from December. The
 * country is looked up at about 10 km, so more places share one Nominatim request; a place right
 * on a border may get its neighbour's holidays.
 */
async function placeHolidays(coordinates: Coordinates, fetchFn: typeof fetch) {
	const area = {
		lat: Math.round(coordinates.lat * 10) / 10,
		lon: Math.round(coordinates.lon * 10) / 10
	};
	return optional(
		(async () => {
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
		})()
	);
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
	const nowcastLookup = optional(
		memo(`nowcast:${coordinates.lat},${coordinates.lon}`, 10 * MINUTE, () =>
			fetchNowcast(coordinates, fetch)
		)
	);
	// Waves change slowly; an hour's cache serves a coast's many readers.
	const marineLookup = optional(
		memo(`marine:${coordinates.lat},${coordinates.lon}`, HOUR, () =>
			fetchMarine(coordinates, fetch)
		)
	);
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
		// The two hours from the current quarter hour; recordings hold the whole day.
		const steps = await nowcastLookup;
		const nowcast = steps?.filter((s) => s.time >= `${time.slice(0, 13)}:00`).slice(0, 9);
		const marine = await marineLookup;
		const sea = marine && seaToday(marine, time);
		// Open-Meteo updates hourly; 15 minutes keeps "now" fresh while the CDN absorbs repeats.
		setHeaders({
			'cache-control':
				'public, max-age=300, s-maxage=900, stale-while-revalidate=600, stale-if-error=86400'
		});
		return json({
			...forecast,
			sky,
			...(holidays && { holidays }),
			...(sea && { sea }),
			...(nowcast?.length && { nowcast })
		});
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
