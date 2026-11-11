// How dry it has been (H-04): the last day with rain and the month's rain so far, from the days
// before today. Today is left out because its total still includes forecast hours.
import { RAIN_DAY_MM } from '#lib/year.js';

export type RainDay = { date: string; rain: number };

export type DrySpell = {
	/** The last day before today with at least `RAIN_DAY_MM`, or null if none in the days given. */
	last: RainDay | null;
	/** Full dry days between that day and today; 0 when it rained yesterday. */
	dryDays: number;
	/** How many days back the data reaches, for "no rain in the last 60 days". */
	covered: number;
	/** This month before today, or null on the first of the month. */
	month: { rain: number; rainDays: number } | null;
};

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export function drySpell(days: RainDay[], today: string): DrySpell | null {
	const before = days.filter((d) => d.date < today);
	if (!before.length) return null;
	const last = before.findLast((d) => d.rain >= RAIN_DAY_MM) ?? null;
	const thisMonth = before.filter((d) => d.date.startsWith(today.slice(0, 7)));
	return {
		last,
		dryDays: last ? daysBetween(last.date, today) - 1 : before.length,
		covered: before.length,
		month: thisMonth.length
			? {
					rain: Math.round(thisMonth.reduce((sum, d) => sum + d.rain, 0) * 10) / 10,
					rainDays: thisMonth.filter((d) => d.rain >= RAIN_DAY_MM).length
				}
			: null
	};
}
