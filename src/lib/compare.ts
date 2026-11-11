// Two places side by side (X-07): each day is rated by its best hour for a walk, the most
// general activity, and the clearly better place is marked.
import { activities, bestWindow } from '#lib/activities.js';
import type { Day, Forecast } from '#lib/weather.js';

/** Points apart before one place counts as better; closer than this is a draw. */
const CLEARLY = 10;
/**
 * Waking hours a day needs left in both places to be compared: today is nearly over in a place
 * hours ahead, and judging its last evening against a whole afternoon would always lose.
 */
const MIN_AWAKE_HOURS = 8;

export type ComparedDay = {
	date: string;
	a: Day;
	b: Day;
	/** Which place is clearly nicer that day, or null for about the same. */
	better: 'a' | 'b' | null;
	/** False when too little of the day is left in one place to judge it. */
	rated: boolean;
};

const awakeHoursLeft = (forecast: Forecast, date: string) =>
	forecast.hours.filter((h) => {
		const hour = Number(h.time.slice(11, 13));
		return h.time.startsWith(date) && hour >= 6 && hour < 23;
	}).length;

function dayScore(forecast: Forecast, date: string): number {
	const hours = forecast.hours.filter((h) => h.time.startsWith(date));
	if (!hours.length) return 0;
	return bestWindow(activities.walk, hours, forecast.days).window?.score ?? 0;
}

/** The dates both forecasts cover, in order. */
export function compareDays(a: Forecast, b: Forecast): ComparedDay[] {
	return a.days.flatMap((dayA) => {
		const dayB = b.days.find((d) => d.date === dayA.date);
		if (!dayB) return [];
		const rated =
			awakeHoursLeft(a, dayA.date) >= MIN_AWAKE_HOURS &&
			awakeHoursLeft(b, dayA.date) >= MIN_AWAKE_HOURS;
		const diff = dayScore(a, dayA.date) - dayScore(b, dayA.date);
		const better = !rated || Math.abs(diff) < CLEARLY ? null : diff > 0 ? 'a' : 'b';
		return [{ date: dayA.date, a: dayA, b: dayB, better, rated }];
	});
}
