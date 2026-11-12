// Shared shapes for the rain radar view (M-01): past radar from RainViewer, the next hours from
// a grid of Open-Meteo forecasts around the place, which also gives the temperature and wind
// layers (M-05).

import { compass } from '#lib/format.js';

/** RainViewer serves radar tiles up to this zoom; beyond it the map stretches these. */
export const RADAR_MAX_ZOOM = 7;

export type RadarFrame = { /** Unix seconds, UTC. */ time: number; path: string };
export type RadarFrames = { host: string; frames: RadarFrame[] };

export type GridHour = {
	time: string;
	rain: number;
	chance: number;
	temperature: number;
	/** km/h */
	wind: number;
	/** Degrees the wind comes from, 0 is north. */
	windFrom: number;
};
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

export type GridLayer = 'rain' | 'temperature' | 'wind';

/** Below this difference between opposite edges of the grid, the temperature counts as even. */
export const EVEN_DEGREES = 2;

const hourAt = (cell: GridCell, time: string) => cell.hours.find((h) => h.time === time);
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * Which side of the place is warmer at an hour, and by how much: the points north of the middle
 * are compared with those south of it, east with west, and the larger difference wins. Null when
 * it is within EVEN_DEGREES. Sides come from each point's coordinates, not the order of the list.
 */
export function warmerSide(
	cells: GridCell[],
	time: string
): { side: 'n' | 'e' | 's' | 'w'; by: number } | null {
	if (cells.length < 2) return null;
	const middle = { lat: mean(cells.map((c) => c.lat)), lon: mean(cells.map((c) => c.lon)) };
	const warmth = (pick: (cell: GridCell) => boolean) =>
		mean(cells.filter(pick).map((c) => hourAt(c, time)?.temperature ?? NaN));
	const northSouth = warmth((c) => c.lat > middle.lat) - warmth((c) => c.lat < middle.lat);
	const eastWest = warmth((c) => c.lon > middle.lon) - warmth((c) => c.lon < middle.lon);
	if (Number.isNaN(northSouth + eastWest)) return null;
	const [by, side] =
		Math.abs(northSouth) >= Math.abs(eastWest)
			? [northSouth, northSouth > 0 ? ('n' as const) : ('s' as const)]
			: [eastWest, eastWest > 0 ? ('e' as const) : ('w' as const)];
	return Math.abs(by) < EVEN_DEGREES ? null : { side, by: Math.abs(by) };
}

/** Below this speed everywhere, the wind has no direction worth naming. */
export const CALM_KMH = 3;

/**
 * The wind around the place at an hour: the strongest speed, and the direction it mostly comes
 * from (directions averaged as vectors, weighted by speed, so 350° and 10° make north). Null when
 * it is calm everywhere.
 */
export function windAround(
	cells: GridCell[],
	time: string
): { from: ReturnType<typeof compass>; max: number } | null {
	const hours = cells.map((c) => hourAt(c, time)).filter((h) => h !== undefined);
	const max = Math.max(0, ...hours.map((h) => h.wind));
	if (max < CALM_KMH) return null;
	const rad = (deg: number) => (deg * Math.PI) / 180;
	const x = hours.reduce((sum, h) => sum + h.wind * Math.sin(rad(h.windFrom)), 0);
	const y = hours.reduce((sum, h) => sum + h.wind * Math.cos(rad(h.windFrom)), 0);
	return { from: compass((Math.atan2(x, y) * 180) / Math.PI), max };
}
