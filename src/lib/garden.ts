// Does the garden need anything? (X-16): water when the last week's rain fell short of what the
// ground lost to evaporation, and ground frost in the days ahead. Only says something worth acting on.

/** One day: rain and reference evaporation (FAO ET₀) in mm, and the lowest soil surface temperature. */
export type GardenDay = { date: string; rain: number; et0: number; groundMin: number };

/** A week's shortfall from this many mm is worth watering for. */
export const WATER_SHORT = 10;
/** Rain from this many mm today or tomorrow makes watering wait. */
export const RAIN_SOON = 5;
/** Fewer past days than this make the balance meaningless. */
const MIN_PAST = 5;

export type Garden = {
	/** Mm short over the past days; null when the rain kept up. */
	short: number | null;
	rainSoon: boolean;
	/** Days ahead (today first) with ground frost. */
	frost: string[];
};

const nextDay = (date: string) =>
	new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** The advice for `today`, or null when there is nothing to do. */
export function gardenAdvice(days: GardenDay[], today: string): Garden | null {
	const past = days.filter((d) => d.date < today);
	const ahead = days.filter((d) => d.date >= today);
	if (past.length < MIN_PAST || !ahead.length) return null;

	const balance = past.reduce((sum, d) => sum + d.rain - d.et0, 0);
	const short = -balance >= WATER_SHORT ? Math.round(-balance) : null;
	const soon = ahead
		.filter((d) => d.date === today || d.date === nextDay(today))
		.reduce((sum, d) => sum + d.rain, 0);
	// Frost is news after mild days; once the whole past week froze, the garden is in winter already.
	const wintry = past.every((d) => d.groundMin <= 0);
	const frost = wintry ? [] : ahead.filter((d) => d.groundMin <= 0).map((d) => d.date);

	if (short === null && !frost.length) return null;
	return { short, rainSoon: soon >= RAIN_SOON, frost };
}
