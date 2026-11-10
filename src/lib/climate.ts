// How today compares with the climate (H-01) and with the same date in recent years (H-02).

/** Eleven values: the 0th, 10th, ..., 100th percentile. */
export type Deciles = number[];
/** The 1991 to 2020 normal for a calendar day, from days within a week of it in every year. */
export type Normal = { date: string; max: Deciles; min: Deciles };
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
