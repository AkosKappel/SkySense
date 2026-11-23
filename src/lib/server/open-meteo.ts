import { SKYSENSE_FIXTURES } from '$app/env/private';
import { z } from 'zod';
import {
	conditionOf,
	roundCoordinates,
	type Coordinates,
	type Day,
	type Forecast,
	pollenKinds,
	type Hour,
	type Spread
} from '#lib/weather.js';
import type { Climate, Normal } from '#lib/climate.js';
import { modelIds, type ModelRun } from '#lib/models.js';
import type { DailyHistory } from '#lib/year.js';
import type { DayNormal } from '#lib/history.js';
import { RECORD_FROM, summarizeRecord, type ClimateRecord } from '#lib/trend.js';
import { areaPoints, type AreaCell } from '#lib/better.js';
import { gridPoints } from '#lib/grid.js';
import type { GridCell, RadarFrames } from '#lib/radar.js';
import { pressureAt } from '#lib/pressure.js';
import type { RecentDay } from '#lib/recent.js';
import type { HindcastDay } from '#lib/hindcast.js';
import type { GardenDay } from '#lib/garden.js';
import type { Holiday } from '#lib/holidays.js';
import { SITE_URL } from '#lib/site.js';

export class WeatherServiceError extends Error {}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
/** 51 members, global, 15 days: one model everywhere keeps the confidence comparable between places. */
const ENSEMBLE_MODEL = 'ecmwf_ifs025_ensemble';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
/** Open-Meteo has no reverse geocoding; OpenStreetMap's Nominatim names a position (F-12, 0006). */
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const HOLIDAYS_URL = 'https://date.nager.at/api/v3/PublicHolidays';
/** Nominatim's usage policy asks every app to identify itself. */
const REVERSE_AGENT = `SkySense (${SITE_URL})`;
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
	'is_day',
	'pressure_msl',
	'visibility',
	'dew_point_2m',
	'cloud_cover'
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
	utc_offset_seconds: z.number(),
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
		is_day: numbers,
		// Optional: fixtures recorded before H-06 and some models lack it.
		pressure_msl: numbers.optional(),
		// Optional for the same reason (F-23).
		visibility: numbers.optional(),
		dew_point_2m: numbers.optional(),
		cloud_cover: numbers.optional()
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

type HourlyColumns = Omit<ForecastResponse['hourly'], 'pressure_msl'>;
type DailyColumns = ForecastResponse['daily'];

function toHour(h: HourlyColumns, i: number, temp: number): Hour {
	return {
		time: h.time[i],
		temp,
		feels: h.apparent_temperature[i] ?? temp,
		condition: conditionOf(h.weather_code[i] ?? 3),
		isDay: h.is_day[i] === 1,
		rainChance: h.precipitation_probability[i] ?? 0,
		rain: h.precipitation[i] ?? 0,
		wind: h.wind_speed_10m[i] ?? 0,
		gust: h.wind_gusts_10m[i] ?? 0,
		uv: h.uv_index[i] ?? 0,
		visibility: h.visibility?.[i] ?? undefined,
		dewPoint: h.dew_point_2m?.[i] ?? undefined,
		clouds: h.cloud_cover?.[i] ?? undefined
	};
}

function toDay(d: DailyColumns, i: number, max: number, min: number): Day {
	return {
		date: d.time[i],
		condition: conditionOf(d.weather_code[i] ?? 3),
		max,
		min,
		rainChance: d.precipitation_probability_max[i] ?? 0,
		rain: d.precipitation_sum[i] ?? 0,
		...sunTimes(d.time[i], d.sunrise[i], d.sunset[i]),
		uvMax: d.uv_index_max[i] ?? 0
	};
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
		hours.push(toHour(h, i, temp));
	}

	const days: Day[] = [];
	for (let i = 0; i < d.time.length && days.length < DAYS; i++) {
		const max = d.temperature_2m_max[i];
		const min = d.temperature_2m_min[i];
		if (max === null || min === null) break;
		days.push(toDay(d, i, max, min));
	}

	const c = data.current;
	return {
		timezone: data.timezone,
		utcOffsetSeconds: data.utc_offset_seconds,
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
			humidity: c.relative_humidity_2m,
			pressure: h.pressure_msl ? pressureAt(h.pressure_msl, first) : null
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

const airSchema = z.object({
	hourly: z
		.object({ time: z.array(z.string()), european_aqi: numbers })
		.catchall(z.array(z.unknown()))
});
type Air = Pick<Hour, 'aqi' | 'pollen'>;

/** Per hour: the air quality index and the strongest pollen above zero, keyed by time. */
export function toAir(raw: unknown): Record<string, Air> {
	const parsed = airSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected air quality response');
	const h = parsed.data.hourly;
	const air: Record<string, Air> = {};
	h.time.forEach((time, i) => {
		const entry: Air = {};
		const aqi = h.european_aqi[i];
		if (aqi !== null) entry.aqi = aqi;
		for (const kind of pollenKinds) {
			const grains = (h[`${kind}_pollen`] as (number | null)[] | undefined)?.[i];
			if (typeof grains === 'number' && grains > 0 && grains > (entry.pollen?.grains ?? 0)) {
				entry.pollen = { kind, grains };
			}
		}
		if (entry.aqi !== undefined || entry.pollen) air[time] = entry;
	});
	return air;
}

export function withAir(forecast: Forecast, air: Record<string, Air>): Forecast {
	return {
		...forecast,
		hours: forecast.hours.map((h) => (air[h.time] ? { ...h, ...air[h.time] } : h))
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

const archiveSchema = z.object({
	daily: z.object({
		time: z.array(z.string()),
		temperature_2m_max: numbers,
		temperature_2m_min: numbers,
		precipitation_sum: numbers
	})
});
const NORMAL_YEARS = [1991, 2020] as const;
const NORMAL_WINDOW_DAYS = 7;
const PAST_YEARS = 10;

/** Day of the year in a common year, so 29 February sits next to 1 March. */
const dayOfYear = (date: string) =>
	(Date.UTC(2001, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) - Date.UTC(2001, 0, 1)) /
	86_400_000;
const daysApart = (a: string, b: string) => {
	const d = Math.abs(dayOfYear(a) - dayOfYear(b));
	return Math.min(d, 365 - d);
};
const deciles = (values: number[]) => {
	const sorted = values.toSorted((a, b) => a - b);
	return Array.from({ length: 11 }, (_, i) => tenth(quantile(sorted, i / 10)));
};
const addDays = (date: string, n: number) => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
};

/**
 * From daily ERA5 history, for every day of `month` ("2026-11"): the 1991 to 2020 normal (all days
 * within a week of it, in all 30 years) and the same day in each of the last ten years.
 */
export function toClimate(raw: unknown, month: string): Climate {
	const parsed = archiveSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected archive response');
	const d = parsed.data.daily;
	const rows = d.time.flatMap((time, i) => {
		const max = d.temperature_2m_max[i];
		const min = d.temperature_2m_min[i];
		return max === null || min === null
			? []
			: [{ date: time, max, min, rain: d.precipitation_sum[i] ?? 0 }];
	});
	const year = Number(month.slice(0, 4));
	const inNormal = rows.filter((r) => {
		const y = Number(r.date.slice(0, 4));
		return y >= NORMAL_YEARS[0] && y <= NORMAL_YEARS[1];
	});

	const normals: Normal[] = [];
	for (let day = `${month}-01`; day.startsWith(month); day = addDays(day, 1)) {
		const near = inNormal.filter((r) => daysApart(r.date, day) <= NORMAL_WINDOW_DAYS);
		if (near.length) {
			normals.push({
				date: day,
				max: deciles(near.map((r) => r.max)),
				min: deciles(near.map((r) => r.min)),
				rain: deciles(near.map((r) => r.rain))
			});
		}
	}
	const monthPart = month.slice(4);
	const past = rows.filter((r) => {
		const y = Number(r.date.slice(0, 4));
		return y >= year - PAST_YEARS && y < year && r.date.slice(4, 7) === monthPart;
	});
	return { normals, past };
}

/** One request covers both: 1991 up to the end of the same month last year. */
export async function fetchClimate(
	coordinates: Coordinates,
	month: string,
	fetchFn: typeof fetch = fetch
): Promise<Climate> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		const name = nearestFixture({ lat, lon });
		return toClimate(fixtures[`./fixtures/climate-${name}.json`].default, month);
	}
	const lastYear = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}-01`;
	const url = new URL(ARCHIVE_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		start_date: `${NORMAL_YEARS[0]}-01-01`,
		end_date: addDays(addMonth(lastYear), -1),
		daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
		models: 'era5',
		timezone: 'auto'
	}).toString();
	return toClimate(await getJson(url, fetchFn), month);
}

const addMonth = (date: string) => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCMonth(d.getUTCMonth() + 1);
	return d.toISOString().slice(0, 10);
};

const yearSchema = z.object({
	daily: z.object({
		time: z.array(z.string()),
		temperature_2m_max: numbers,
		temperature_2m_min: numbers,
		precipitation_sum: numbers,
		wind_gusts_10m_max: numbers
	})
});

/** ERA5 days, gaps (the last days ERA5 has not reached yet) dropped (H-09). */
export function toHistory(raw: unknown): DailyHistory {
	const parsed = yearSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected archive response');
	const d = parsed.data.daily;
	return d.time.flatMap((date, i) => {
		const max = d.temperature_2m_max[i];
		const min = d.temperature_2m_min[i];
		if (max === null || min === null) return [];
		return [
			{ date, max, min, rain: d.precipitation_sum[i] ?? 0, gust: d.wind_gusts_10m_max[i] ?? 0 }
		];
	});
}

/** Each day from `from` to `to`, a year at most (the route checks it), so the request stays light. */
export async function fetchHistory(
	coordinates: Coordinates,
	from: string,
	to: string,
	fetchFn: typeof fetch = fetch
): Promise<DailyHistory> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		const name = nearestFixture({ lat, lon });
		return toHistory(fixtures[`./fixtures/history-${name}.json`].default).filter(
			(d) => d.date >= from && d.date <= to
		);
	}
	const url = new URL(ARCHIVE_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		start_date: from,
		end_date: to,
		daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max',
		models: 'era5',
		timezone: 'auto'
	}).toString();
	return toHistory(await getJson(url, fetchFn));
}

/**
 * The 1991 to 2020 normal of every calendar day, from all days within a week of it in all 30
 * years: mean high, low and daily rain (H-09). 29 February shares 1 March's.
 */
function normalsOf(rows: { date: string; max: number; min: number; rain: number }[]): DayNormal[] {
	const totals = Array.from({ length: 365 }, () => ({ max: 0, min: 0, rain: 0, n: 0 }));
	for (const { date, max, min, rain } of rows) {
		const year = Number(date.slice(0, 4));
		if (year < NORMAL_YEARS[0] || year > NORMAL_YEARS[1]) continue;
		const t = totals[dayOfYear(date)];
		t.max += max;
		t.min += min;
		t.rain += rain;
		t.n++;
	}
	const normals: DayNormal[] = [];
	// A leap year, so the list has 29 February too.
	for (let date = '2020-01-01'; date < '2021-01-01'; date = addDays(date, 1)) {
		const sum = { max: 0, min: 0, rain: 0, n: 0 };
		for (let k = -NORMAL_WINDOW_DAYS; k <= NORMAL_WINDOW_DAYS; k++) {
			const t = totals[(dayOfYear(date) + k + 365) % 365];
			sum.max += t.max;
			sum.min += t.min;
			sum.rain += t.rain;
			sum.n += t.n;
		}
		if (sum.n) {
			normals.push({
				day: date.slice(5),
				max: tenth(sum.max / sum.n),
				min: tenth(sum.min / sum.n),
				rain: tenth(sum.rain / sum.n)
			});
		}
	}
	return normals;
}

/** ERA5 days from 1961 reduced to the daily normals, years and months (H-09, H-10). */
export function toRecord(raw: unknown): ClimateRecord {
	const parsed = archiveSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected archive response');
	const d = parsed.data.daily;
	const rows = d.time.flatMap((date, i) => {
		const max = d.temperature_2m_max[i];
		const min = d.temperature_2m_min[i];
		return max === null || min === null
			? []
			: [{ date, max, min, rain: d.precipitation_sum[i] ?? 0 }];
	});
	return { normals: normalsOf(rows), ...summarizeRecord(rows) };
}

/**
 * The long record of an ERA5 cell, 1961 to the end of `lastYear`: one heavy request (about 23,000
 * days) that the route caches for a year, as the past it covers never changes.
 */
export async function fetchRecord(
	cell: Coordinates,
	lastYear: number,
	fetchFn: typeof fetch = fetch
): Promise<ClimateRecord> {
	if (useFixtures()) {
		return toRecord(fixtures[`./fixtures/record-${nearestFixture(cell)}.json`].default);
	}
	const url = new URL(ARCHIVE_URL);
	url.search = new URLSearchParams({
		latitude: String(cell.lat),
		longitude: String(cell.lon),
		start_date: `${RECORD_FROM}-01-01`,
		end_date: `${lastYear}-12-31`,
		daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
		models: 'era5',
		timezone: 'auto'
	}).toString();
	return toRecord(await getJson(url, fetchFn));
}

const recentSchema = z.object({
	daily: z.object({
		time: z.array(z.string()),
		precipitation_sum: numbers,
		temperature_2m_max: numbers,
		temperature_2m_min: numbers
	})
});

/** Rain, high and low per day, gaps dropped (H-04, H-08). */
export function toRecent(raw: unknown): RecentDay[] {
	const parsed = recentSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected forecast response');
	const d = parsed.data.daily;
	return d.time.flatMap((date, i) => {
		const rain = d.precipitation_sum[i];
		const max = d.temperature_2m_max[i];
		const min = d.temperature_2m_min[i];
		return rain === null || max === null || min === null ? [] : [{ date, rain, max, min }];
	});
}

export const RECENT_DAYS = 60;

/** Rain, high and low on each of the 60 days before `today` (the place's date), from the forecast API's past. */
export async function fetchRecent(
	coordinates: Coordinates,
	today: string,
	fetchFn: typeof fetch = fetch
): Promise<RecentDay[]> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		return toRecent(fixtures[`./fixtures/recent-${nearestFixture({ lat, lon })}.json`].default);
	}
	const url = new URL(FORECAST_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min',
		timezone: 'auto',
		start_date: addDays(today, -RECENT_DAYS),
		end_date: addDays(today, -1)
	}).toString();
	return toRecent(await getJson(url, fetchFn));
}

/** Keeps each model run's forecast, so a day's forecast from one day ahead can be read back (X-14). */
const PREVIOUS_RUNS_URL = 'https://previous-runs-api.open-meteo.com/v1/forecast';
export const HINDCAST_DAYS = 30;

const hindcastSchema = z.object({
	hourly: z.object({
		time: z.array(z.string()),
		temperature_2m: numbers,
		temperature_2m_previous_day1: numbers,
		precipitation: numbers,
		precipitation_previous_day1: numbers
	})
});

/** Hourly values folded into days; a day with a missing hour is dropped rather than half counted. */
export function toHindcast(raw: unknown): HindcastDay[] {
	const parsed = hindcastSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected previous runs response');
	const h = parsed.data.hourly;
	const days = new Map<string, number[]>();
	h.time.forEach((time, i) => {
		const date = time.slice(0, 10);
		days.set(date, [...(days.get(date) ?? []), i]);
	});
	return [...days].flatMap(([date, hours]) => {
		const column = (values: (number | null)[]) => hours.map((i) => values[i]);
		const high = column(h.temperature_2m);
		const forecastHigh = column(h.temperature_2m_previous_day1);
		const rain = column(h.precipitation);
		const forecastRain = column(h.precipitation_previous_day1);
		const all = [high, forecastHigh, rain, forecastRain];
		if (all.some((values) => values.some((v) => v === null))) return [];
		const [hi, fhi, r, fr] = all as number[][];
		const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10;
		return [
			{
				date,
				high: Math.max(...hi),
				forecastHigh: Math.max(...fhi),
				rain: sum(r),
				forecastRain: sum(fr)
			}
		];
	});
}

/** The 30 days before `today`, forecast a day ahead and as they turned out. */
export async function fetchHindcast(
	coordinates: Coordinates,
	today: string,
	fetchFn: typeof fetch = fetch
): Promise<HindcastDay[]> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		return toHindcast(fixtures[`./fixtures/hindcast-${nearestFixture({ lat, lon })}.json`].default);
	}
	const url = new URL(PREVIOUS_RUNS_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'temperature_2m,temperature_2m_previous_day1,precipitation,precipitation_previous_day1',
		timezone: 'auto',
		start_date: addDays(today, -HINDCAST_DAYS),
		end_date: addDays(today, -1)
	}).toString();
	return toHindcast(await getJson(url, fetchFn));
}

const gardenSchema = z.object({
	daily: z.object({
		time: z.array(z.string()),
		precipitation_sum: numbers,
		et0_fao_evapotranspiration: numbers
	}),
	hourly: z.object({ time: z.array(z.string()), soil_temperature_0cm: numbers })
});

/** Days with rain, evaporation and the coldest soil surface hour; days with a gap are dropped (X-16). */
export function toGarden(raw: unknown): GardenDay[] {
	const parsed = gardenSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected garden response');
	const { daily, hourly } = parsed.data;
	return daily.time.flatMap((date, i) => {
		const rain = daily.precipitation_sum[i];
		const et0 = daily.et0_fao_evapotranspiration[i];
		const ground = hourly.time.flatMap((time, h) => {
			const value = hourly.soil_temperature_0cm[h];
			return time.startsWith(date) && value !== null ? [value] : [];
		});
		if (rain === null || et0 === null || ground.length < 24) return [];
		return [{ date, rain, et0, groundMin: Math.min(...ground) }];
	});
}

/** The week before `today` and the week from it, for watering and ground frost (X-16). */
export async function fetchGarden(
	coordinates: Coordinates,
	today: string,
	fetchFn: typeof fetch = fetch
): Promise<GardenDay[]> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		return toGarden(fixtures[`./fixtures/garden-${nearestFixture({ lat, lon })}.json`].default);
	}
	const url = new URL(FORECAST_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		daily: 'precipitation_sum,et0_fao_evapotranspiration',
		hourly: 'soil_temperature_0cm',
		timezone: 'auto',
		start_date: addDays(today, -7),
		end_date: addDays(today, 6)
	}).toString();
	return toGarden(await getJson(url, fetchFn));
}

const gridSchema = z.array(
	z.object({
		latitude: z.number(),
		longitude: z.number(),
		hourly: z.object({
			time: z.array(z.string()),
			precipitation: numbers,
			precipitation_probability: numbers,
			temperature_2m: numbers,
			wind_speed_10m: numbers,
			wind_direction_10m: numbers
		})
	})
);

/** Points on each side of the place; 5 × 5 points about 33 km apart cover some 130 km. */
const GRID_STEPS = 2;
const GRID_DEGREES = 0.3;
const GRID_HOURS = 3;

export function toGrid(raw: unknown): GridCell[] {
	const parsed = gridSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected grid response');
	return parsed.data.map((point) => ({
		lat: point.latitude,
		lon: point.longitude,
		hours: point.hourly.time.map((time, i) => ({
			time,
			rain: point.hourly.precipitation[i] ?? 0,
			chance: point.hourly.precipitation_probability[i] ?? 0,
			temperature: point.hourly.temperature_2m[i] ?? NaN,
			wind: point.hourly.wind_speed_10m[i] ?? 0,
			windFrom: point.hourly.wind_direction_10m[i] ?? 0
		}))
	}));
}

/** The model's rain, temperature and wind for the next hours around a place: one request for all 25 points. */
export async function fetchGrid(
	coordinates: Coordinates,
	fetchFn: typeof fetch = fetch
): Promise<GridCell[]> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		return toGrid(fixtures[`./fixtures/grid-${nearestFixture({ lat, lon })}.json`].default);
	}
	const points = gridPoints({ lat, lon }, GRID_STEPS, GRID_DEGREES);
	const url = new URL(FORECAST_URL);
	url.search = new URLSearchParams({
		latitude: points.map((p) => p.lat).join(','),
		longitude: points.map((p) => p.lon).join(','),
		hourly:
			'precipitation,precipitation_probability,temperature_2m,wind_speed_10m,wind_direction_10m',
		timezone: 'auto',
		forecast_hours: String(GRID_HOURS + 1)
	}).toString();
	return toGrid(await getJson(url, fetchFn));
}

const areaSchema = z.array(
	z.object({
		latitude: z.number(),
		longitude: z.number(),
		hourly: forecastSchema.shape.hourly,
		daily: forecastSchema.shape.daily
	})
);

// Only what the activity scores read: Open-Meteo counts more than ten variables as extra calls.
const areaHourly = hourly.slice(0, hourly.indexOf('pressure_msl'));

export function toArea(raw: unknown): AreaCell[] {
	const parsed = areaSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected area response');
	return parsed.data.map((point) => {
		const h = point.hourly;
		const d = point.daily;
		const hours = h.time.flatMap((_, i) => {
			const temp = h.temperature_2m[i];
			return temp === null ? [] : [toHour(h, i, temp)];
		});
		const max = d.temperature_2m_max[0];
		const min = d.temperature_2m_min[0];
		return {
			lat: point.latitude,
			lon: point.longitude,
			hours,
			day: max === null || min === null ? null : toDay(d, 0, max, min)
		};
	});
}

/** The recorded day stands in for any day asked for, so the view works offline with fixtures. */
function onDate(cells: AreaCell[], date: string): AreaCell[] {
	const move = (time: string) => date + time.slice(10);
	return cells.map((cell) => ({
		...cell,
		hours: cell.hours.map((hour) => ({ ...hour, time: move(hour.time) })),
		day: cell.day && {
			...cell.day,
			date,
			sunrise: cell.day.sunrise && move(cell.day.sunrise),
			sunset: cell.day.sunset && move(cell.day.sunset)
		}
	}));
}

/** One day of hourly weather on a grid around a place, for "where is the weather better?". */
export async function fetchArea(
	coordinates: Coordinates,
	date: string,
	fetchFn: typeof fetch = fetch
): Promise<AreaCell[]> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		const name = nearestFixture({ lat, lon });
		return onDate(toArea(fixtures[`./fixtures/area-${name}.json`].default), date);
	}
	const points = areaPoints({ lat, lon });
	const url = new URL(FORECAST_URL);
	url.search = new URLSearchParams({
		latitude: points.map((p) => p.lat).join(','),
		longitude: points.map((p) => p.lon).join(','),
		hourly: areaHourly.join(','),
		daily: daily.join(','),
		timezone: 'auto',
		start_date: date,
		end_date: date
	}).toString();
	return toArea(await getJson(url, fetchFn));
}

const RADAR_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const radarSchema = z.object({
	host: z.string().url(),
	radar: z.object({ past: z.array(z.object({ time: z.number(), path: z.string() })) })
});

/** RainViewer's list of past radar frames (2 hours, every 10 minutes), reduced to what tiles need. */
export function toRadarFrames(raw: unknown): RadarFrames {
	const parsed = radarSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected radar response');
	return { host: parsed.data.host, frames: parsed.data.radar.past };
}

export async function fetchRadarFrames(fetchFn: typeof fetch = fetch): Promise<RadarFrames> {
	if (useFixtures()) return toRadarFrames(fixtures['./fixtures/radar-frames.json'].default);
	return toRadarFrames(await getJson(new URL(RADAR_URL), fetchFn));
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
async function getJson(url: URL, fetchFn: typeof fetch, headers?: HeadersInit): Promise<unknown> {
	for (let attempt = 1; ; attempt++) {
		let response: Response;
		try {
			response = await fetchFn(url, { headers, signal: AbortSignal.timeout(8000) });
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

/** Recorded situations for screenshots (T-11), picked with `?demo=` when fixtures are on. */
export const demoScenarios = ['heat', 'polar-night', 'midnight-sun'] as const;
export type DemoScenario = (typeof demoScenarios)[number];

export async function fetchForecast(
	coordinates: Coordinates,
	fetchFn: typeof fetch = fetch,
	demo?: DemoScenario
): Promise<Forecast> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures() && demo)
		return toForecast(fixtures[`./fixtures/scenario-${demo}.json`].default);
	if (useFixtures()) {
		const name = nearestFixture({ lat, lon });
		return withAir(
			withSpread(
				toForecast(fixtures[`./fixtures/forecast-${name}.json`].default),
				toSpread(fixtures[`./fixtures/ensemble-${name}.json`].default)
			),
			toAir(fixtures[`./fixtures/air-${name}.json`].default)
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
	const [forecast, spread, air] = await Promise.all([
		getJson(url, fetchFn).then(toForecast),
		fetchSpread({ lat, lon }, fetchFn).catch(() => ({})),
		fetchAir({ lat, lon }, fetchFn).catch(() => ({}))
	]);
	return withAir(withSpread(forecast, spread), air);
}

/** Like the ensemble, extra: the forecast loads without it. Five days is the API's range. */
async function fetchAir(
	{ lat, lon }: Coordinates,
	fetchFn: typeof fetch
): Promise<Record<string, Air>> {
	const url = new URL(AIR_URL);
	url.search = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: ['european_aqi', ...pollenKinds.map((k) => `${k}_pollen`)].join(','),
		timezone: 'auto',
		forecast_days: '5'
	}).toString();
	return toAir(await getJson(url, fetchFn));
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

const reverseSchema = z.object({
	name: z.string().optional(),
	address: z
		.object({
			city: z.string().optional(),
			town: z.string().optional(),
			village: z.string().optional(),
			municipality: z.string().optional()
		})
		.optional()
});

/** The name of the town or city at a position, or null where there is none (the open sea). */
export function toAreaName(raw: unknown): string | null {
	const parsed = reverseSchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected reverse geocoding response');
	const { name, address } = parsed.data;
	// The city before the result's own name, which can be a district ("District of Bratislava I").
	const area = address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? name;
	return area?.trim().slice(0, 80) || null;
}

/** Nominatim allows one request a second; a second one sooner is skipped, not queued. */
const REVERSE_GAP_MS = 1000;
let lastReverse = 0;

export async function reverseGeocode(
	coordinates: Coordinates,
	language: string,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		return toAreaName(fixtures[`./fixtures/reverse-${nearestFixture({ lat, lon })}.json`].default);
	}
	const now = Date.now();
	if (now - lastReverse < REVERSE_GAP_MS) throw new WeatherServiceError('Reverse geocoder busy');
	lastReverse = now;
	const url = new URL(REVERSE_URL);
	url.search = new URLSearchParams({
		lat: String(lat),
		lon: String(lon),
		format: 'jsonv2',
		// City level: the town's name, not the street.
		zoom: '10',
		'accept-language': language
	}).toString();
	return toAreaName(await getJson(url, fetchFn, { 'user-agent': REVERSE_AGENT }));
}

const countrySchema = z.object({
	address: z.object({ country_code: z.string().length(2).optional() }).optional()
});

/** The two-letter country code at a position (lower case), or null at sea. */
export function toCountryCode(raw: unknown): string | null {
	const parsed = countrySchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected reverse geocoding response');
	return parsed.data.address?.country_code?.toLowerCase() ?? null;
}

/** The country at a position, for its public holidays (F-26). Shares the geocoder's one-a-second gap. */
export async function countryAt(
	coordinates: Coordinates,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	const { lat, lon } = roundCoordinates(coordinates);
	if (useFixtures()) {
		return toCountryCode(
			fixtures[`./fixtures/reverse-${nearestFixture({ lat, lon })}.json`].default
		);
	}
	const now = Date.now();
	if (now - lastReverse < REVERSE_GAP_MS) throw new WeatherServiceError('Reverse geocoder busy');
	lastReverse = now;
	const url = new URL(REVERSE_URL);
	url.search = new URLSearchParams({
		lat: String(lat),
		lon: String(lon),
		format: 'jsonv2',
		zoom: '3'
	}).toString();
	return toCountryCode(await getJson(url, fetchFn, { 'user-agent': REVERSE_AGENT }));
}

const holidaySchema = z.array(
	z.object({
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		localName: z.string(),
		name: z.string(),
		global: z.boolean()
	})
);

/**
 * A country's public holidays in a year from Nager.Date, nationwide ones only: a regional holiday
 * (one German state's) would be wrong for most of the country. A country it lacks has none.
 */
export function toHolidays(raw: unknown): Holiday[] {
	const parsed = holidaySchema.safeParse(raw);
	if (!parsed.success) throw new WeatherServiceError('Unexpected holidays response');
	return parsed.data
		.filter((h) => h.global)
		.map(({ date, localName, name }) => ({ date, localName, name }));
}

export async function fetchHolidays(
	country: string,
	year: number,
	fetchFn: typeof fetch = fetch
): Promise<Holiday[]> {
	if (useFixtures()) {
		const recorded = fixtures[`./fixtures/holidays-${country}-${year}.json`];
		return recorded ? toHolidays(recorded.default) : [];
	}
	const response = await fetchFn(`${HOLIDAYS_URL}/${year}/${country.toUpperCase()}`, {
		signal: AbortSignal.timeout(8000)
	}).catch((cause) => {
		throw new WeatherServiceError('Holidays service unreachable', { cause });
	});
	// 404 for a country it does not cover, 204 for a year without data.
	if (response.status === 404 || response.status === 204) return [];
	if (!response.ok) throw new WeatherServiceError(`Holidays service answered ${response.status}`);
	return toHolidays(await response.json());
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
