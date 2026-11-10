import { SKYSENSE_FIXTURES } from '$app/env/private';
import { z } from 'zod';
import {
	conditionOf,
	roundCoordinates,
	type Coordinates,
	type Day,
	type Forecast,
	type Hour,
	type Spread
} from '#lib/weather.js';
import { modelIds, type ModelRun } from '#lib/models.js';

export class WeatherServiceError extends Error {}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
/** 51 members, global, 15 days: one model everywhere keeps the confidence comparable between places. */
const ENSEMBLE_MODEL = 'ecmwf_ifs025_ensemble';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
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

/** Turns Open-Meteo's column arrays into hour and day records, from the current hour to the end of the tenth day. */
export function toForecast(raw: unknown): Forecast {
	const parsed = forecastSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected forecast response');
	const data: ForecastResponse = parsed.data;
	const h = data.hourly;
	const d = data.daily;

	const currentHour = `${data.current.time.slice(0, 13)}:00`;
	const first = Math.max(0, h.time.indexOf(currentHour));
	const hours: Hour[] = [];
	for (let i = first; i < h.time.length; i++) {
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
		fetchedAt: new Date().toISOString(),
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

const ensembleSchema = z.object({
	hourly: z.object({ time: z.array(z.string()) }).catchall(z.array(z.number().nullable()))
});

/** Linear interpolation between ranks, on a sorted list. */
function quantile(sorted: number[], q: number): number {
	const position = (sorted.length - 1) * q;
	const below = Math.floor(position);
	const above = Math.min(below + 1, sorted.length - 1);
	return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
}

const MIN_MEMBERS = 10;
const RAIN_MM = 0.1;
const tenth = (n: number) => Math.round(n * 10) / 10;

/**
 * Reduces the ensemble's members to a spread per hour, keyed by time, so the browser gets three
 * numbers an hour instead of a hundred. Hours with too few members left (the far end) are skipped.
 */
export function toSpread(raw: unknown): Record<string, Spread> {
	const parsed = ensembleSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected ensemble response');
	const { time, ...columns } = parsed.data.hourly;
	const members = (prefix: string) =>
		Object.entries(columns)
			.filter(([key]) => key === prefix || key.startsWith(`${prefix}_member`))
			.map(([, values]) => values);
	const temps = members('temperature_2m');
	const rain = members('precipitation');

	const spread: Record<string, Spread> = {};
	time.forEach((t, i) => {
		const temp = temps.map((m) => m[i]).filter((v) => v !== null);
		const wet = rain.map((m) => m[i]).filter((v) => v !== null);
		if (temp.length < MIN_MEMBERS || wet.length < MIN_MEMBERS) return;
		temp.sort((a, b) => a - b);
		spread[t] = {
			low: tenth(quantile(temp, 0.1)),
			high: tenth(quantile(temp, 0.9)),
			rain: Math.round((wet.filter((v) => v >= RAIN_MM).length / wet.length) * 100)
		};
	});
	return spread;
}

/** Adds the spread to the hours it covers; the forecast stands on its own without it. */
export function withSpread(forecast: Forecast, spread: Record<string, Spread>): Forecast {
	return {
		...forecast,
		hours: forecast.hours.map((h) => (spread[h.time] ? { ...h, spread: spread[h.time] } : h))
	};
}

const modelsSchema = z.object({
	hourly: z.object({ time: z.array(z.string()) }).catchall(z.array(z.number().nullable()))
});
/** Today and the next three days: past that, Météo-France and others run out. */
const MODEL_DAYS = 4;

/** One run per model, each cut where its range ends; a model with no data is left out. */
export function toModelRuns(raw: unknown): ModelRun[] {
	const parsed = modelsSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected models response');
	const { time, ...columns } = parsed.data.hourly;
	return modelIds.flatMap((id) => {
		const temps = columns[`temperature_2m_${id}`];
		const rain = columns[`precipitation_${id}`] ?? [];
		if (!temps) return [];
		const end = temps.findIndex((t) => t === null);
		const hours = time.slice(0, end === -1 ? time.length : end).map((t, i) => ({
			time: t,
			temp: temps[i] as number,
			rain: rain[i] ?? 0
		}));
		return hours.length ? [{ id, hours }] : [];
	});
}

export async function fetchModels(
	coordinates: Coordinates,
	fetchFn: typeof fetch = fetch
): Promise<ModelRun[]> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		return toModelRuns(fixtures[`./fixtures/models-${nearestFixture({ lat, lon })}.json`].default);
	}
	const url = new URL(FORECAST_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'temperature_2m,precipitation',
		models: modelIds.join(','),
		timezone: 'auto',
		forecast_days: String(MODEL_DAYS)
	}).toString();
	return toModelRuns(await getJson(url, fetchFn));
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
				country_code: z.string().optional(),
				admin1: z.string().optional()
			})
		)
		.optional()
});

/** `country` (ISO 3166-1 alpha-2) moves the reader's own country's places up, keeping the order otherwise. */
export function toPlaces(raw: unknown, country?: string): Place[] {
	const parsed = placesSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected geocoding response');
	const results = parsed.data.results ?? [];
	const local = (r: (typeof results)[number]) => (r.country_code === country ? 0 : 1);
	return results
		.toSorted((a, b) => local(a) - local(b))
		.map((r) => ({
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

function nearestFixture({ lat, lon }: Coordinates): string {
	const [name] = Object.entries(fixturePlaces).sort(
		([, a], [, b]) => Math.hypot(a.lat - lat, a.lon - lon) - Math.hypot(b.lat - lat, b.lon - lon)
	)[0];
	return name;
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
	if (useFixtures()) {
		const name = nearestFixture({ lat, lon });
		return withSpread(
			toForecast(fixtures[`./fixtures/forecast-${name}.json`].default),
			toSpread(fixtures[`./fixtures/ensemble-${name}.json`].default)
		);
	}

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
	const [forecast, spread] = await Promise.all([
		getJson(url, fetchFn).then(toForecast),
		fetchSpread({ lat, lon }, fetchFn).catch(() => ({}))
	]);
	return withSpread(forecast, spread);
}

/** The ensemble is extra: when it fails, the forecast still loads, only without confidence. */
async function fetchSpread(
	{ lat, lon }: Coordinates,
	fetchFn: typeof fetch
): Promise<Record<string, Spread>> {
	const url = new URL(ENSEMBLE_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'temperature_2m,precipitation',
		models: ENSEMBLE_MODEL,
		timezone: 'auto',
		forecast_days: String(DAYS)
	}).toString();
	return toSpread(await getJson(url, fetchFn));
}

export async function searchPlaces(
	query: string,
	language: string,
	country?: string,
	fetchFn: typeof fetch = fetch
): Promise<Place[]> {
	if (useFixtures()) {
		const all = toPlaces(fixtures['./fixtures/places-bratisl.json'].default, country);
		return all.filter((p) => p.name.toLowerCase().startsWith(query.toLowerCase().slice(0, 3)));
	}
	const url = new URL(GEOCODING_URL);
	url.search = new URLSearchParams({
		name: query,
		count: '8',
		language,
		format: 'json'
	}).toString();
	return toPlaces(await getJson(url, fetchFn), country);
}
