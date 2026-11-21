// How good was the forecast? (X-14): the forecast made a day ahead against what the models settled
// on afterwards, for the days before today. "What happened" is the latest model run's first hours,
// not a weather station, which is the nearest thing Open-Meteo has for yesterday (ERA5 lags 5 days).
import { RAIN_DAY_MM } from '#lib/year.js';

export type HindcastDay = {
	date: string;
	high: number;
	forecastHigh: number;
	rain: number;
	forecastRain: number;
};

/** A day counts as forecast right when its high was within this many degrees and rain came as expected. */
export const HIGH_TOLERANCE = 2;
/** Fewer days than this make a hit rate too noisy to show. */
const MIN_DAYS = 7;

export type ForecastCheck = {
	/** Forecast high minus the actual high, in °C: positive means the forecast was too warm. */
	highError: number;
	/** The rain day forecast right, missed (it rained), or expected but dry. */
	rain: 'right' | 'missed' | 'unexpected';
	/** Days forecast right and days counted, or null when too few days are known. */
	rate: { hits: number; days: number } | null;
};

const dayBefore = (date: string) =>
	new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const isRainDay = (mm: number) => mm >= RAIN_DAY_MM;

function rainCheck(day: HindcastDay): ForecastCheck['rain'] {
	const forecast = isRainDay(day.forecastRain);
	const actual = isRainDay(day.rain);
	if (forecast === actual) return 'right';
	return actual ? 'missed' : 'unexpected';
}

/** Yesterday's forecast and the hit rate over the days before `today`, or null without yesterday. */
export function checkForecast(days: HindcastDay[], today: string): ForecastCheck | null {
	const yesterday = dayBefore(today);
	const last = days.find((d) => d.date === yesterday);
	if (!last) return null;
	const past = days.filter((d) => d.date <= yesterday);
	const hits = past.filter(
		(d) => Math.abs(d.forecastHigh - d.high) <= HIGH_TOLERANCE && rainCheck(d) === 'right'
	).length;
	return {
		highError: Math.round((last.forecastHigh - last.high) * 10) / 10,
		rain: rainCheck(last),
		rate: past.length >= MIN_DAYS ? { hits, days: past.length } : null
	};
}
