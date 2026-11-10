// Activity scoring and windows (S-02, S-03). Each activity is a set of factors; a factor maps one
// hour to 0..1, and the hour's score is their weighted geometric mean, so one bad factor (rain
// for laundry) sinks the score instead of being averaged away. Thresholds: docs/decisions/0003.
import { moon } from '#lib/moon.js';
import { skyKind } from '#lib/sky.js';
import type { Day, Hour } from '#lib/weather.js';

export const activityIds = ['run', 'cycle', 'walk', 'laundry', 'stars', 'golden'] as const;
export type ActivityId = (typeof activityIds)[number];

/** Why an hour scores low, as a message key in the UI. */
export type Reason =
	| 'cold'
	| 'hot'
	| 'rain'
	| 'wind'
	| 'dark'
	| 'daylight'
	| 'clouds'
	| 'notGolden'
	| 'uv'
	| 'moon'
	| 'air';

/** How someone feels temperature (S-05): the comfort ranges move by this many °C. */
export const comfortShift = { cold: 3, neutral: 0, warm: -3 } as const;
export type Comfort = keyof typeof comfortShift;

/** What a factor measures, as a label in the "why this score" breakdown (S-06). */
export type FactorId =
	'feels' | 'temp' | 'rain' | 'wind' | 'light' | 'uv' | 'clouds' | 'moon' | 'air';

type Context = { hours: Hour[]; index: number; days: Day[]; shift: number };
type Factor = {
	id: FactorId;
	weight: number;
	/** A requirement rather than a preference (night for stars): hours failing it do not explain a low score. */
	gate?: boolean;
	reason: Reason | ((hour: Hour, context: Context) => Reason);
	value: (hour: Hour, context: Context) => number;
};

/** 1 inside the ideal range, falling linearly to 0 at the edge of the acceptable range. */
export function band(value: number, ok: [number, number], ideal: [number, number]): number {
	if (value >= ideal[0] && value <= ideal[1]) return 1;
	if (value < ideal[0]) return Math.max(0, (value - ok[0]) / (ideal[0] - ok[0]));
	return Math.max(0, (ok[1] - value) / (ok[1] - ideal[1]));
}

/** Feels-like comfort; someone who gets cold easily wants it `shift` degrees warmer. */
const comfort = (ok: [number, number], ideal: [number, number], weight = 2): Factor => ({
	id: 'feels',
	weight,
	reason: (h, { shift }) => (h.feels - shift < ideal[0] ? 'cold' : 'hot'),
	value: (h, { shift }) => band(h.feels - shift, ok, ideal)
});
const dry = (okUpTo: number, idealUpTo: number, weight = 3): Factor => ({
	id: 'rain',
	weight,
	reason: 'rain',
	value: (h) => band(h.rainChance, [0, okUpTo], [0, idealUpTo])
});
const calm = (okUpTo: number, idealUpTo: number, weight = 1.5): Factor => ({
	id: 'wind',
	weight,
	reason: 'wind',
	// Gusts count at 60%: a gusty 20 km/h feels like a steady 30.
	value: (h) => band(Math.max(h.wind, h.gust * 0.6), [0, okUpTo], [0, idealUpTo])
});
/** Daylight preferred; `dark` is the factor's value at night (0 rules the night out). */
const daylight = (dark: number): Factor => ({
	id: 'light',
	weight: 1,
	reason: 'dark',
	value: (h) => (h.isDay ? 1 : dark)
});
/** Nobody wants a 03:00 run suggested: 23:00 to 06:00 is for sleeping. */
const awake: Factor = {
	id: 'light',
	weight: 1,
	gate: true,
	reason: 'dark',
	value: (h) => {
		const hour = Number(h.time.slice(11, 13));
		return hour >= 6 && hour < 23 ? 1 : 0;
	}
};
/** Hard breathing in poor air (H-03): from "moderate" on, falling to 0 at "extremely poor". */
const clean: Factor = {
	id: 'air',
	weight: 2,
	reason: 'air',
	value: (h) => (h.aqi === undefined ? 1 : band(h.aqi, [0, 100], [0, 40]))
};
const sunburn: Factor = {
	id: 'uv',
	weight: 0.5,
	reason: 'uv',
	value: (h) => band(h.uv, [0, 10], [0, 5])
};

/** `hours`: how long the activity usually takes, the length of the window suggested. */
export type Activity = { id: ActivityId; hours: number; factors: Factor[] };

export const activities: Record<ActivityId, Activity> = {
	run: {
		id: 'run',
		hours: 1,
		factors: [
			comfort([-5, 28], [6, 18]),
			dry(70, 20),
			calm(45, 20),
			daylight(0.6),
			awake,
			sunburn,
			clean
		]
	},
	cycle: {
		id: 'cycle',
		hours: 2,
		factors: [
			comfort([2, 32], [12, 24]),
			dry(50, 10),
			calm(35, 15, 2),
			daylight(0.3),
			awake,
			sunburn,
			clean
		]
	},
	walk: {
		id: 'walk',
		hours: 1,
		factors: [
			comfort([-8, 31], [8, 24]),
			dry(80, 30),
			calm(50, 25, 1),
			daylight(0.7),
			awake,
			sunburn
		]
	},
	laundry: {
		id: 'laundry',
		hours: 4,
		factors: [
			{
				id: 'temp',
				weight: 2,
				reason: (h) => (h.temp < 15 ? 'cold' : 'hot'),
				value: (h) => band(h.temp, [4, 38], [15, 32])
			},
			// Laundry has to stay dry for the next hours too, not only this one.
			{
				id: 'rain',
				weight: 4,
				reason: 'rain',
				value: (_, { hours, index }) =>
					band(
						Math.max(...hours.slice(index, index + 4).map((h) => h.rainChance)),
						[0, 40],
						[0, 10]
					)
			},
			// Some wind dries; a gale blows it away.
			{ id: 'wind', weight: 1, reason: 'wind', value: (h) => band(h.wind, [0, 45], [8, 25]) },
			{ ...daylight(0), gate: true }
		]
	},
	stars: {
		id: 'stars',
		hours: 1,
		factors: [
			{ id: 'light', weight: 3, gate: true, reason: 'daylight', value: (h) => (h.isDay ? 0 : 1) },
			{
				id: 'clouds',
				weight: 3,
				reason: 'clouds',
				value: (h) => (h.condition === 'clear' ? 1 : h.condition === 'partly' ? 0.4 : 0)
			},
			// A full moon washes out all but the brightest stars: at most "good", never "great".
			{
				id: 'moon',
				weight: 1.5,
				reason: 'moon',
				value: (h) => 1 - 0.8 * moon(h.time).illumination
			},
			dry(40, 10, 1)
		]
	},
	golden: {
		id: 'golden',
		hours: 1,
		factors: [
			{
				id: 'light',
				weight: 3,
				gate: true,
				reason: 'notGolden',
				value: (h, { days }) => {
					const day = days.find((d) => h.time.startsWith(d.date));
					const kind = day ? skyKind(h, day) : null;
					return kind === 'dawn' || kind === 'dusk' ? 1 : 0;
				}
			},
			// Broken clouds catch the light best; overcast already rules out dawn and dusk above.
			{
				id: 'clouds',
				weight: 1,
				reason: 'clouds',
				value: (h) => (h.condition === 'partly' ? 1 : 0.8)
			},
			dry(40, 10, 1)
		]
	}
};

/** A factor's value from 0 to 1; requirements are left out, as a window always meets them. */
export type FactorValue = { id: FactorId; value: number };
export type HourScore = {
	score: number;
	reason: Reason | null;
	gated: boolean;
	factors: FactorValue[];
};

export function scoreHour(activity: Activity, context: Context): HourScore {
	const hour = context.hours[context.index];
	const total = activity.factors.reduce((sum, f) => sum + f.weight, 0);
	let product = 1;
	let worst: { value: number; reason: Reason } | null = null;
	let gated = false;
	const factors: FactorValue[] = [];
	for (const factor of activity.factors) {
		const value = factor.value(hour, context);
		if (factor.gate && value === 0) gated = true;
		if (!factor.gate) factors.push({ id: factor.id, value });
		product *= value ** (factor.weight / total);
		const reason =
			typeof factor.reason === 'function' ? factor.reason(hour, context) : factor.reason;
		if (value < 1 && (!worst || value < worst.value)) worst = { value, reason };
	}
	return { score: Math.round(product * 100), reason: worst?.reason ?? null, gated, factors };
}

/** From this score an hour is good enough to go. */
export const GOOD = 60;

export type ActivityWindow = { from: string; until: string; score: number; hours: Hour[] };

/** What a result rests on: the window's average, or the best hour when there is no window. */
export type Detail = { time: string; score: number; factors: FactorValue[] };

/**
 * The best stretch of the activity's length within `hours` (highest average score, every hour
 * good, the earliest on a tie), or null with the reason it falls short. `shift` is the comfort
 * profile's offset in °C.
 */
export function bestWindow(
	activity: Activity,
	hours: Hour[],
	days: Day[],
	shift = 0
): { window: ActivityWindow | null; reason: Reason | null; detail: Detail | null } {
	const scores = hours.map((_, index) => scoreHour(activity, { hours, index, days, shift }));
	const length = activity.hours;
	let best: ActivityWindow | null = null;
	let bestStart = 0;
	for (let start = 0; start + length <= hours.length; start++) {
		const slice = scores.slice(start, start + length);
		if (slice.some((s) => s.score < GOOD)) continue;
		const average = Math.round(slice.reduce((sum, s) => sum + s.score, 0) / length);
		if (!best || average > best.score) {
			const last = hours[start + length - 1].time;
			bestStart = start;
			best = {
				from: hours[start].time,
				until: addHours(last, 1),
				score: average,
				hours: hours.slice(start, start + length)
			};
		}
	}
	if (best) {
		const slice = scores.slice(bestStart, bestStart + length);
		const factors = slice[0].factors.map(({ id }, i) => ({
			id,
			value: slice.reduce((sum, s) => sum + s.factors[i].value, 0) / length
		}));
		return { window: best, reason: null, detail: { time: best.from, score: best.score, factors } };
	}
	// Explain with the best hour that meets the requirements (a clear night, not just any night).
	const open = scores.map((s, i) => ({ ...s, i })).filter((s) => !s.gated);
	if (!open.length) return { window: null, reason: scores[0]?.reason ?? null, detail: null };
	const top = open.reduce((a, b) => (b.score > a.score ? b : a));
	return {
		window: null,
		reason: top.reason,
		detail: { time: hours[top.i].time, score: top.score, factors: top.factors }
	};
}

function addHours(time: string, n: number): string {
	const date = new Date(`${time}:00Z`);
	date.setUTCHours(date.getUTCHours() + n);
	return date.toISOString().slice(0, 16);
}
