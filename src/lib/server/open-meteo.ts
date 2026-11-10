import { SKYSENSE_FIXTURES } from '$app/env/private';
import { z } from 'zod';
import {
	conditionOf,
	roundCoordinates,
	type Coordinates,
	type Day,
	type Forecast,
	type Hour
} from '#lib/weather.js';

export class WeatherServiceError extends Error {}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const HOURS = 48;
const DAYS = 10;

const hourly = [
	'temperature_2m',
	'apparent_temperature',
	'precipitation_probability',
	'precipitation',
	'weather_code',
	'wind_speed_10m',
	'wind_gusts_10m',
	'uv_index',
	'is_day'
] as const;

const daily = [
	'weather_code',
	'temperature_2m_max',
	'temperature_2m_min',
	'precipitation_probability_max',
	'precipitation_sum',
	'sunrise',
	'sunset',
	'uv_index_max'
] as const;

const current = [
	'temperature_2m',
	'apparent_temperature',
	'weather_code',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'relative_humidity_2m',
	'is_day'
] as const;

// Open-Meteo leaves gaps as null at the far end of a model's range.
const numbers = z.array(z.number().nullable());

const forecastSchema = z.object({
	timezone: z.string(),
	current: z.object({
		time: z.string(),
		temperature_2m: z.number(),
		apparent_temperature: z.number(),
		weather_code: z.number(),
		wind_speed_10m: z.number(),
		wind_gusts_10m: z.number(),
		wind_direction_10m: z.number(),
		relative_humidity_2m: z.number(),
		is_day: z.number()
	}),
	hourly: z.object({
		time: z.array(z.string()),
		temperature_2m: numbers,
		apparent_temperature: numbers,
		precipitation_probability: numbers,
		precipitation: numbers,
		weather_code: numbers,
		wind_speed_10m: numbers,
		wind_gusts_10m: numbers,
		uv_index: numbers,
		is_day: numbers
	}),
	daily: z.object({
		time: z.array(z.string()),
		weather_code: numbers,
		temperature_2m_max: numbers,
		temperature_2m_min: numbers,
		precipitation_probability_max: numbers,
		precipitation_sum: numbers,
		sunrise: z.array(z.string().nullable()),
		sunset: z.array(z.string().nullable()),
		uv_index_max: numbers
	})
});

type ForecastResponse = z.infer<typeof forecastSchema>;

/**
 * Open-Meteo has no "never" for the sun: in polar night it gives sunrise and sunset both at the
 * day's midnight, under the midnight sun midnight to the next midnight. Both mean the sun does not
 * cross the horizon that day, so both become null; the day's hours tell which case it is.
 */
export function sunTimes(date: string, sunrise: string | null, sunset: string | null) {
	const midnight = `${date}T00:00`;
	if (
		!sunrise ||
		!sunset ||
		(sunrise === midnight && (sunset === midnight || sunset > `${date}T23:59`))
	) {
		return { sunrise: null, sunset: null };
	}
	return { sunrise, sunset };
}

/** Turns Open-Meteo's column arrays into hour and day records, from the current hour on. */
export function toForecast(raw: unknown): Forecast {
	const parsed = forecastSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected forecast response');
	const data: ForecastResponse = parsed.data;
	const h = data.hourly;
	const d = data.daily;

	const currentHour = `${data.current.time.slice(0, 13)}:00`;
	const first = Math.max(0, h.time.indexOf(currentHour));
	const hours: Hour[] = [];
	for (let i = first; i < h.time.length && hours.length < HOURS; i++) {
		const temp = h.temperature_2m[i];
		if (temp === null) break;
		hours.push({
			time: h.time[i],
			temp,
			feels: h.apparent_temperature[i] ?? temp,
			condition: conditionOf(h.weather_code[i] ?? 3),
			isDay: h.is_day[i] === 1,
			rainChance: h.precipitation_probability[i] ?? 0,
			rain: h.precipitation[i] ?? 0,
			wind: h.wind_speed_10m[i] ?? 0,
			gust: h.wind_gusts_10m[i] ?? 0,
			uv: h.uv_index[i] ?? 0
		});
	}

	const days: Day[] = [];
	for (let i = 0; i < d.time.length && days.length < DAYS; i++) {
		const max = d.temperature_2m_max[i];
		const min = d.temperature_2m_min[i];
		if (max === null || min === null) break;
		days.push({
			date: d.time[i],
			condition: conditionOf(d.weather_code[i] ?? 3),
			max,
			min,
			rainChance: d.precipitation_probability_max[i] ?? 0,
			rain: d.precipitation_sum[i] ?? 0,
			...sunTimes(d.time[i], d.sunrise[i], d.sunset[i]),
			uvMax: d.uv_index_max[i] ?? 0
		});
	}

	const c = data.current;
	return {
		timezone: data.timezone,
		current: {
			time: c.time,
			temp: c.temperature_2m,
			feels: c.apparent_temperature,
			condition: conditionOf(c.weather_code),
			isDay: c.is_day === 1,
			wind: c.wind_speed_10m,
			gust: c.wind_gusts_10m,
			windDirection: c.wind_direction_10m,
			humidity: c.relative_humidity_2m
		},
		hours,
		days
	};
}

export type Place = {
	id: number;
	name: string;
	/** Region and country, for telling places with the same name apart. */
	detail: string;
	lat: number;
	lon: number;
};

const placesSchema = z.object({
	results: z
		.array(
			z.object({
				id: z.number(),
				name: z.string(),
				latitude: z.number(),
				longitude: z.number(),
				country: z.string().optional(),
				admin1: z.string().optional()
			})
		)
		.optional()
});

export function toPlaces(raw: unknown): Place[] {
	const parsed = placesSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected geocoding response');
	return (parsed.data.results ?? []).map((r) => ({
		id: r.id,
		name: r.name,
		detail: [r.admin1, r.country].filter((part) => part && part !== r.name).join(', '),
		lat: r.latitude,
		lon: r.longitude
	}));
}

// Recorded responses (T-08) for tests, e2e and screenshots: set SKYSENSE_FIXTURES=1.
const fixtures = import.meta.glob<{ default: unknown }>('./fixtures/*.json', { eager: true });
const fixturePlaces: Record<string, Coordinates> = {
	bratislava: { lat: 48.15, lon: 17.11 },
	madrid: { lat: 40.42, lon: -3.7 },
	tromso: { lat: 69.65, lon: 18.96 },
	norilsk: { lat: 69.35, lon: 88.2 },
	singapore: { lat: 1.29, lon: 103.85 }
};

function nearestFixture({ lat, lon }: Coordinates): unknown {
	const [name] = Object.entries(fixturePlaces).sort(
		([, a], [, b]) => Math.hypot(a.lat - lat, a.lon - lon) - Math.hypot(b.lat - lat, b.lon - lon)
	)[0];
	return fixtures[`./fixtures/forecast-${name}.json`].default;
}

const useFixtures = () => SKYSENSE_FIXTURES;

const RETRY_DELAY_MS = 300;

/**
 * One retry for network errors and 5xx answers, which are usually a brief blip; 4xx answers
 * (including 429, the free tier's rate limit) are final.
 */
async function getJson(url: URL, fetchFn: typeof fetch): Promise<unknown> {
	for (let attempt = 1; ; attempt++) {
		let response: Response;
		try {
			response = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
		} catch (cause) {
			if (attempt < 2) {
				await new Promise((done) => setTimeout(done, RETRY_DELAY_MS));
				continue;
			}
			throw new WeatherServiceError('Weather service unreachable', { cause });
		}
		if (response.ok) return response.json();
		if (response.status >= 500 && attempt < 2) {
			await new Promise((done) => setTimeout(done, RETRY_DELAY_MS));
			continue;
		}
		throw new WeatherServiceError(`Weather service answered ${response.status}`);
	}
}

export async function fetchForecast(
	coordinates: Coordinates,
	fetchFn: typeof fetch = fetch
): Promise<Forecast> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) return toForecast(nearestFixture({ lat, lon }));

	const url = new URL(FORECAST_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		current: current.join(','),
		hourly: hourly.join(','),
		daily: daily.join(','),
		timezone: 'auto',
		forecast_days: String(DAYS)
	}).toString();
	return toForecast(await getJson(url, fetchFn));
}

export async function searchPlaces(
	query: string,
	language: string,
	fetchFn: typeof fetch = fetch
): Promise<Place[]> {
	if (useFixtures()) {
		const all = toPlaces(fixtures['./fixtures/places-bratisl.json'].default);
		return all.filter((p) => p.name.toLowerCase().startsWith(query.toLowerCase().slice(0, 3)));
	}
	const url = new URL(GEOCODING_URL);
	url.search = new URLSearchParams({
		name: query,
		count: '8',
		language,
		format: 'json'
	}).toString();
	return toPlaces(await getJson(url, fetchFn));
}
