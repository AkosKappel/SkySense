// How today compares with the climate (H-01), whether that is unusual (H-08), and the same date in
// recent years (H-02).
import { RAIN_DAY_MM } from '#lib/year.js';

/** Eleven values: the 0th, 10th, ..., 100th percentile. */
export type Deciles = number[];
/** The 1991 to 2020 normal for a calendar day, from days within a week of it in every year. */
export type Normal = { date: string; max: Deciles; min: Deciles; rain: Deciles };
/** One day of a recent year, for "on this day". */
export type PastDay = { date: string; max: number; min: number; rain: number };
/**
 * Everything for one month at one place: a normal for each day and each day in the last ten
 * years. Keyed by month, not day, as one archive request weighs like hundreds of forecast calls.
 */
export type Climate = { normals: Normal[]; past: PastDay[] };

/** Below this difference from the median high, a day counts as normal. */
export const NORMAL_WITHIN = 1.5;

/** The share of the climate's days below `value`, in percent, interpolated between deciles. */
export function percentBelow(value: number, deciles: Deciles): number {
	if (value <= deciles[0]) return 0;
	if (value >= deciles[10]) return 100;
	const i = deciles.findIndex((d) => d > value) - 1;
	const span = deciles[i + 1] - deciles[i];
	return Math.round((i + (span ? (value - deciles[i]) / span : 0)) * 10);
}

export type Comparison = {
	kind: 'warmer' | 'colder' | 'normal';
	/** °C from the median high, always positive. */
	diff: number;
	/** Percent of days around this date that were colder. */
	percent: number;
};

export function compareToNormal(max: number, normal: Normal): Comparison {
	const diff = max - normal.max[5];
	const kind = Math.abs(diff) < NORMAL_WITHIN ? 'normal' : diff > 0 ? 'warmer' : 'colder';
	return { kind, diff: Math.abs(diff), percent: percentBelow(max, normal.max) };
}

/** The normal and the same date in recent years, newest first, for a day of the month loaded. */
export function forDate(climate: Climate, date: string) {
	const monthDay = date.slice(4);
	return {
		normal: climate.normals.find((n) => n.date.endsWith(monthDay)) ?? null,
		past: climate.past
			.filter((d) => d.date.endsWith(monthDay))
			.toSorted((a, b) => b.date.localeCompare(a.date))
	};
}

/** Fewer past years than this make "the warmest in years" too easy to reach. */
const RECORD_YEARS = 5;

/**
 * Whether today's high would beat the same date in every past year loaded (F-27), as a fact for
 * the past-years tile; null when it would not or too few years are known.
 */
export function pastRecord(max: number, past: PastDay[]): 'warmest' | 'coldest' | null {
	if (past.length < RECORD_YEARS) return null;
	if (past.every((d) => max > d.max)) return 'warmest';
	if (past.every((d) => max < d.max)) return 'coldest';
	return null;
}

/** One way today stands out: its high, its low (the night) or its rain, as a share of the normal's days. */
export type Standout = { measure: 'day' | 'night' | 'rain'; percent: number };
export type Unusual = { level: 'usual' | 'unusual' | 'rare'; standouts: Standout[] };

/**
 * Whether today is unusual for the time of year (H-08): beyond the 10th or 90th percentile of
 * the days around this date in 1991 to 2020 is unusual, beyond all of them is rare. Rain only
 * counts on the wet side, and from a rain day: most days are dry, so a dry one says nothing.
 */
export function unusual(
	today: { max: number; min: number; rain: number },
	normal: Normal
): Unusual {
	const standouts: Standout[] = [
		{ measure: 'day' as const, percent: percentBelow(today.max, normal.max) },
		{ measure: 'night' as const, percent: percentBelow(today.min, normal.min) },
		...(today.rain >= RAIN_DAY_MM
			? [{ measure: 'rain' as const, percent: percentBelow(today.rain, normal.rain) }]
			: [])
	].filter((s) => s.percent >= 90 || (s.measure !== 'rain' && s.percent <= 10));
	const rare = standouts.some((s) => s.percent === 100 || s.percent === 0);
	return { level: rare ? 'rare' : standouts.length ? 'unusual' : 'usual', standouts };
}

/** Fewer days of the week with a normal than this, and the week says nothing. */
const WEEK_DAYS_NEEDED = 4;

/**
 * The 7 days before today against their normal median high and low (H-08), in °C; null when too
 * few of them have a normal (the first days of a month, as the climate is loaded by month).
 */
export function lastWeek(
	days: { date: string; max: number; min: number }[],
	climate: Climate,
	today: string
): number | null {
	const week = days.filter((d) => d.date < today).slice(-7);
	const diffs = week.flatMap((d) => {
		const normal = climate.normals.find((n) => n.date.endsWith(d.date.slice(4)));
		return normal ? [(d.max + d.min) / 2 - (normal.max[5] + normal.min[5]) / 2] : [];
	});
	if (diffs.length < WEEK_DAYS_NEEDED) return null;
	return Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10;
}
