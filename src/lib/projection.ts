// Where the climate is heading (X-20), from Open-Meteo's Climate API: CMIP6 HighResMIP models
// downscaled to 10 km, on a path close to high emissions. Each model's 2040s are compared with its
// own 1995 to 2014 (the IPCC AR6 reference period), so a model's bias cancels out, and the spread
// between the models is the uncertainty the reader sees.
export const PROJECTION_BASE = [1995, 2014] as const;
export const PROJECTION_FUTURE = [2041, 2050] as const;
/** A model missing more than this share of either period's days is left out. */
const MAX_GAPS = 0.2;

export type Projection = { models: number; median: number; low: number; high: number };

const tenth = (n: number) => Math.round(n * 10) / 10;

function meanOf(values: (number | null)[]): number | null {
	const known = values.filter((v) => v !== null);
	if (known.length === 0 || known.length < values.length * (1 - MAX_GAPS)) return null;
	return known.reduce((a, b) => a + b, 0) / known.length;
}

/**
 * Each model's daily mean temperatures in both periods, keyed by model, reduced to the middle and
 * the range of their changes in °C. Null with fewer than three usable models: one or two say
 * nothing about how sure the models are.
 */
export function projectionOf(
	base: Record<string, (number | null)[]>,
	future: Record<string, (number | null)[]>
): Projection | null {
	const changes = Object.keys(base).flatMap((model) => {
		const before = meanOf(base[model]);
		const after = meanOf(future[model] ?? []);
		return before === null || after === null ? [] : [after - before];
	});
	if (changes.length < 3) return null;
	const sorted = changes.toSorted((a, b) => a - b);
	const half = sorted.length / 2;
	const median =
		sorted.length % 2 ? sorted[Math.floor(half)] : (sorted[half - 1] + sorted[half]) / 2;
	return {
		models: sorted.length,
		median: tenth(median),
		low: tenth(sorted[0]),
		high: tenth(sorted.at(-1)!)
	};
}
