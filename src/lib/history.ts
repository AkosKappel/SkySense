// Any past day, week, month or year at a place against its 1991 to 2020 normal (H-09).
import { RAIN_DAY_MM, type DailyHistory } from '#lib/year.js';

export const scales = ['day', 'week', 'month', 'year'] as const;
export type Scale = (typeof scales)[number];

/** ERA5 starts here. */
export const FIRST_DAY = '1940-01-01';
/** ERA5 runs about five days behind, so the newest day worth asking for is six days ago. */
export const ERA5_LAG_DAYS = 6;

/** The 1991 to 2020 average for a calendar day ("11-22"): mean high and low, mean daily rain. */
export type DayNormal = { day: string; max: number; min: number; rain: number };

export const addDays = (date: string, n: number) => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
};

/** The first and last day of the period of `scale` that holds `at`; weeks run Monday to Sunday. */
export function periodOf(scale: Scale, at: string): { from: string; to: string } {
	if (scale === 'day') return { from: at, to: at };
	if (scale === 'week') {
		const from = addDays(at, -((new Date(`${at}T00:00:00Z`).getUTCDay() + 6) % 7));
		return { from, to: addDays(from, 6) };
	}
	if (scale === 'year') return { from: `${at.slice(0, 4)}-01-01`, to: `${at.slice(0, 4)}-12-31` };
	const from = `${at.slice(0, 7)}-01`;
	const next = new Date(`${from}T00:00:00Z`);
	next.setUTCMonth(next.getUTCMonth() + 1);
	return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

/** A day in the period before (-1) or after (1) the one holding `at`, its start. */
export function step(scale: Scale, at: string, direction: -1 | 1): string {
	const { from, to } = periodOf(scale, at);
	return periodOf(scale, direction < 0 ? addDays(from, -1) : addDays(to, 1)).from;
}

/**
 * The newest day ERA5 likely has, and the period a scale opens on: the last whole one before
 * it (last month rather than the first days of this one). `today` is the place's date.
 */
export const latestDay = (today: string) => addDays(today, -ERA5_LAG_DAYS);
export const openingDay = (scale: Scale, today: string) => step(scale, latestDay(today), -1);

export type PastDayRecord = { date: string; value: number };

/** The warmest day, coldest night, wettest day and strongest gust of a period; null without days. */
export function records(days: DailyHistory) {
	if (!days.length) return null;
	const pick = (value: (d: DailyHistory[number]) => number, higher: boolean): PastDayRecord => {
		const best = days.reduce((a, b) =>
			(higher ? value(b) > value(a) : value(b) < value(a)) ? b : a
		);
		return { date: best.date, value: value(best) };
	};
	return {
		warmest: pick((d) => d.max, true),
		coldest: pick((d) => d.min, false),
		wettest: pick((d) => d.rain, true),
		windiest: pick((d) => d.gust, true)
	};
}

/** Below this difference from the normal mean temperature, a period was about as warm as usual. */
export const AS_USUAL_WITHIN = 0.5;

export type Bucket = { key: string; max: number; min: number; rain: number; diff: number };
export type AgainstNormal = {
	/** Mean temperature ((high + low) / 2) minus the normal's, in °C. */
	diff: number;
	warmth: 'warmer' | 'colder' | 'usual';
	rain: number;
	normalRain: number;
	wetness: 'wetter' | 'drier' | 'usual';
	/** Months for a year, days otherwise. */
	buckets: Bucket[];
};

const tenth = (n: number) => Math.round(n * 10) / 10;
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** The days of a period against the normal of each of their calendar days; null without days. */
export function againstNormal(
	days: DailyHistory,
	normals: DayNormal[],
	scale: Scale
): AgainstNormal | null {
	const byDay = new Map(normals.map((n) => [n.day, n]));
	const paired = days.flatMap((day) => {
		const normal = byDay.get(day.date.slice(5));
		return normal ? [{ day, normal }] : [];
	});
	if (!paired.length) return null;

	const summarize = (list: typeof paired, key: string): Bucket => ({
		key,
		max: tenth(mean(list.map((p) => p.day.max))),
		min: tenth(mean(list.map((p) => p.day.min))),
		rain: tenth(sum(list.map((p) => p.day.rain))),
		diff: tenth(
			mean(list.map((p) => (p.day.max + p.day.min) / 2 - (p.normal.max + p.normal.min) / 2))
		)
	});
	const groups = Map.groupBy(paired, (p) =>
		scale === 'year' ? p.day.date.slice(0, 7) : p.day.date
	);
	const buckets = [...groups].map(([key, list]) => summarize(list, key));

	const all = summarize(paired, '');
	const normalRain = tenth(sum(paired.map((p) => p.normal.rain)));
	// A share alone would call 0.4 mm against a usual 0.2 mm "twice as wet".
	const wetness =
		all.rain > normalRain * 1.25 && all.rain - normalRain >= RAIN_DAY_MM
			? 'wetter'
			: all.rain < normalRain * 0.75 && normalRain - all.rain >= RAIN_DAY_MM
				? 'drier'
				: 'usual';
	return {
		diff: all.diff,
		warmth: Math.abs(all.diff) < AS_USUAL_WITHIN ? 'usual' : all.diff > 0 ? 'warmer' : 'colder',
		rain: all.rain,
		normalRain,
		wetness,
		buckets
	};
}

/**
 * `?history=month&at=2023-11-14` shows the period of that scale holding that day; a missing or
 * odd scale or day falls back to the last whole month. `today` is the place's date, from the
 * forecast, not the reader's or the server's.
 */
export function choosePeriod(search: { get(name: string): string | null }, today: string) {
	const asked = search.get('history') as Scale;
	const scale = scales.includes(asked) ? asked : 'month';
	const latest = latestDay(today);
	const at = search.get('at') ?? '';
	const valid = /^\d{4}-\d{2}-\d{2}$/.test(at) && !isNaN(Date.parse(at));
	const day = !valid
		? openingDay(scale, today)
		: at < FIRST_DAY
			? FIRST_DAY
			: at > latest
				? latest
				: at;
	const { from, to } = periodOf(scale, day);
	// The archive refuses days in the future; this period's last days simply are not there yet.
	return { scale, at: day, from, to, until: to > latest ? latest : to, latest };
}

/** "2023", "November 2023", "13–19 November 2023" or "14 November 2023". */
export function formatPeriod(scale: Scale, from: string, to: string, locale: string): string {
	const options: Intl.DateTimeFormatOptions =
		scale === 'year'
			? { year: 'numeric' }
			: scale === 'month'
				? { month: 'long', year: 'numeric' }
				: { day: 'numeric', month: 'long', year: 'numeric' };
	const date = (day: string) => new Date(`${day}T00:00:00Z`);
	return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).formatRange(
		date(from),
		date(scale === 'week' ? to : from)
	);
}
