// The forecast as the app uses it, shared by server and browser. Times are the place's local
// wall-clock time as Open-Meteo returns them with `timezone=auto` ("2026-11-10T14:00").

import type { Pressure } from '#lib/pressure.js';

export type Condition =
	'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'snow' | 'thunder';

export type Current = {
	time: string;
	temp: number;
	feels: number;
	condition: Condition;
	isDay: boolean;
	wind: number;
	gust: number;
	windDirection: number;
	humidity: number;
	/** Sea-level pressure and its three-hour change (H-06); missing in older recordings. */
	pressure?: Pressure | null;
};

export type Hour = {
	time: string;
	temp: number;
	feels: number;
	condition: Condition;
	isDay: boolean;
	rainChance: number;
	rain: number;
	wind: number;
	gust: number;
	uv: number;
	/** Visibility in metres, dew point in °C and cloud cover in % (F-23); missing in older recordings. */
	visibility?: number;
	dewPoint?: number;
	clouds?: number;
	/** The ensemble's spread for this hour (C-01), missing when the ensemble is unavailable. */
	spread?: Spread;
	/** European Air Quality Index (H-03), missing where or when the air quality API has none. */
	aqi?: number;
	/** The strongest pollen this hour, in grains per m³; Europe only, missing when there is none. */
	pollen?: { kind: Pollen; grains: number };
};

export const pollenKinds = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'] as const;
export type Pollen = (typeof pollenKinds)[number];

/** How 51 runs of the ECMWF ensemble disagree: the 10th and 90th percentile and the share with rain. */
export type Spread = {
	/** °C: one run in ten is colder than this. */
	low: number;
	/** °C: one run in ten is warmer than this. */
	high: number;
	/** Percent of runs with at least 0.1 mm of rain (or snow, as water) in the hour. */
	rain: number;
};

export type Day = {
	date: string;
	condition: Condition;
	max: number;
	min: number;
	rainChance: number;
	rain: number;
	/** Null during polar night or midnight sun. */
	sunrise: string | null;
	sunset: string | null;
	uvMax: number;
};

export type Forecast = {
	timezone: string;
	/** The place's offset from UTC now, for "8 hours ahead of you" (F-13). */
	utcOffsetSeconds: number;
	/** When our server got it from Open-Meteo (UTC ISO); CDN copies keep this time. */
	fetchedAt: string;
	current: Current;
	/** Every hour from the current one to the end of the last day (the day view needs them). */
	hours: Hour[];
	/** Ten days, starting today. */
	days: Day[];
};

/** WMO weather interpretation codes, as Open-Meteo documents them. */
export function conditionOf(code: number): Condition {
	if (code === 0 || code === 1) return 'clear';
	if (code === 2) return 'partly';
	if (code === 3) return 'cloudy';
	if (code === 45 || code === 48) return 'fog';
	if (code >= 51 && code <= 57) return 'drizzle';
	if ((code >= 61 && code <= 67) || code === 80 || code === 81 || code === 82) {
		return code >= 80 ? 'showers' : 'rain';
	}
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
	if (code >= 95) return 'thunder';
	return 'cloudy';
}

/** A chance of rain from which the umbrella answer says yes. */
export const RAIN_LIKELY = 50;

export type RainWindow = {
	from: string;
	until: string;
	startsNow: boolean;
	/** Still wet at the end of the hours looked at, so `until` is not when it stops. */
	openEnded: boolean;
	/** What falls: thunderstorms win over everything, snow only when no hour brings rain. */
	kind: 'rain' | 'snow' | 'mixed' | 'thunder';
};

const wet: Condition[] = ['drizzle', 'rain', 'showers'];

/**
 * The first stretch of likely rain within the next `withinHours`. `until` is the hour the rain
 * is expected to stop, so a single rainy hour 14:00 gives 14:00 to 15:00.
 */
export function nextRain(hours: Hour[], withinHours = 24): RainWindow | null {
	const window = hours.slice(0, withinHours);
	const start = window.findIndex((h) => h.rainChance >= RAIN_LIKELY);
	if (start === -1) return null;
	let end = start;
	while (end + 1 < window.length && window[end + 1].rainChance >= RAIN_LIKELY) end++;
	const until = hours[end + 1]?.time ?? addHour(hours[end].time);
	const during = window.slice(start, end + 1).map((h) => h.condition);
	const snow = during.includes('snow');
	const kind = during.includes('thunder')
		? 'thunder'
		: snow && during.some((c) => wet.includes(c))
			? 'mixed'
			: snow
				? 'snow'
				: 'rain';
	return {
		from: window[start].time,
		until,
		startsNow: start === 0,
		openEnded: end === window.length - 1,
		kind
	};
}

function addHour(time: string): string {
	const date = new Date(`${time}:00Z`);
	date.setUTCHours(date.getUTCHours() + 1);
	return date.toISOString().slice(0, 16);
}

export type Coordinates = { lat: number; lon: number };

/** Two decimals is about 1 km: precise enough for weather, and nearby visitors share a cache entry. */
export function roundCoordinates({ lat, lon }: Coordinates): Coordinates {
	return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

/** Reads "48.15,17.11" from a place URL; null for anything that is not a point on Earth. */
export function parseCoordinates(value: string): Coordinates | null {
	const match = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(value.trim());
	if (!match) return null;
	const lat = Number(match[1]);
	const lon = Number(match[2]);
	if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
	return roundCoordinates({ lat, lon });
}

export function formatCoordinates(coordinates: Coordinates): string {
	const { lat, lon } = roundCoordinates(coordinates);
	return `${lat},${lon}`;
}
