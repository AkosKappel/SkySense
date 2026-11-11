// Shared shapes for the rain radar view (M-01): past radar from RainViewer, the next hours from
// a grid of Open-Meteo forecasts around the place.

/** RainViewer serves radar tiles up to this zoom; beyond it the map stretches these. */
export const RADAR_MAX_ZOOM = 7;

export type RadarFrame = { /** Unix seconds, UTC. */ time: number; path: string };
export type RadarFrames = { host: string; frames: RadarFrame[] };

export type GridHour = { time: string; rain: number; chance: number };
export type GridCell = { lat: number; lon: number; hours: GridHour[] };

/** From this much rain in an hour, a cell counts as wet (drizzle and up). */
export const GRID_WET_MM = 0.2;

/** The first hour any cell around the place is wet, or null for a dry few hours. */
export function firstWetHour(cells: GridCell[]): string | null {
	const times = cells[0]?.hours.map((h) => h.time) ?? [];
	return (
		times.find((time) =>
			cells.some((c) => (c.hours.find((h) => h.time === time)?.rain ?? 0) >= GRID_WET_MM)
		) ?? null
	);
}
