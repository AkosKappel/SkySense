// Several weather models side by side (C-04), for the curious: how far apart they are is a plain
// measure of how sure anyone can be.

export const modelIds = [
	'ecmwf_ifs025',
	'gfs_seamless',
	'icon_seamless',
	'meteofrance_seamless',
	'ukmo_seamless'
] as const;
export type ModelId = (typeof modelIds)[number];

export type ModelHour = { time: string; temp: number; rain: number };
/** One model's hours, from the start of today until its range ends (they end at different days). */
export type ModelRun = { id: ModelId; hours: ModelHour[] };

/** The hour within `hours` from `from` where the models are furthest apart, and by how much. */
export function widestGap(
	runs: ModelRun[],
	from: string,
	hours: number
): { gap: number; time: string } | null {
	const times =
		runs[0]?.hours
			.map((h) => h.time)
			.filter((t) => t >= from)
			.slice(0, hours) ?? [];
	let widest: { gap: number; time: string } | null = null;
	for (const time of times) {
		const temps = runs.flatMap((r) => r.hours.filter((h) => h.time === time).map((h) => h.temp));
		if (temps.length < 2) continue;
		const gap = Math.max(...temps) - Math.min(...temps);
		if (!widest || gap > widest.gap) widest = { gap, time };
	}
	return widest;
}

/** Rain each model expects within `hours` from `from`, in mm. */
export function rainTotal(run: ModelRun, from: string, hours: number): number {
	return run.hours
		.filter((h) => h.time >= from)
		.slice(0, hours)
		.reduce((sum, h) => sum + h.rain, 0);
}
