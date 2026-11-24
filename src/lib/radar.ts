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
	/** Cloud cover in % (M-07); missing in older recordings. */
	clouds?: number;
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

export type GridLayer = 'rain' | 'temperature' | 'wind' | 'clouds' | 'satellite';

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
	const found = higherSide(cells, (c) => hourAt(c, time)?.temperature ?? NaN);
	return found && found.by >= EVEN_DEGREES ? { side: found.side, by: found.by } : null;
}

/** Below this difference in cloud cover between opposite edges, the sky counts as alike (M-07). */
export const EVEN_CLOUDS = 25;

/**
 * Which side of the place is clearer at an hour, with that side's cloud cover, in the same way as
 * `warmerSide`; null when the sky is within EVEN_CLOUDS everywhere, or there is no cloud data.
 */
export function clearerSide(
	cells: GridCell[],
	time: string
): { side: 'n' | 'e' | 's' | 'w'; clouds: number } | null {
	const clear = (c: GridCell) => 100 - (hourAt(c, time)?.clouds ?? NaN);
	const found = higherSide(cells, clear);
	if (!found || found.by < EVEN_CLOUDS) return null;
	return { side: found.side, clouds: Math.round(100 - found.mean) };
}

/** The mean cloud cover over the grid at an hour, or null without cloud data. */
export function meanClouds(cells: GridCell[], time: string): number | null {
	const value = mean(cells.map((c) => hourAt(c, time)?.clouds ?? NaN));
	return Number.isNaN(value) ? null : Math.round(value);
}

/**
 * The side whose points have the higher mean of `value`: north of the middle against south, east
 * against west, and the larger difference wins. Sides come from each point's coordinates, not the
 * order of the list.
 */
function higherSide(
	cells: GridCell[],
	value: (cell: GridCell) => number
): { side: 'n' | 'e' | 's' | 'w'; by: number; mean: number } | null {
	if (cells.length < 2) return null;
	const middle = { lat: mean(cells.map((c) => c.lat)), lon: mean(cells.map((c) => c.lon)) };
	const side = (pick: (cell: GridCell) => boolean) => mean(cells.filter(pick).map(value));
	const [n, s, e, w] = [
		side((c) => c.lat > middle.lat),
		side((c) => c.lat < middle.lat),
		side((c) => c.lon > middle.lon),
		side((c) => c.lon < middle.lon)
	];
	if (Number.isNaN(n + s + e + w)) return null;
	const [by, high, top] =
		Math.abs(n - s) >= Math.abs(e - w)
			? [n - s, n > s ? ('n' as const) : ('s' as const), Math.max(n, s)]
			: [e - w, e > w ? ('e' as const) : ('w' as const), Math.max(e, w)];
	return { side: high, by: Math.abs(by), mean: top };
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

/** Temperature labels on the map turn blue from here down and yellow from WARM_C up (°C). */
export const FREEZING_C = 0;
export const WARM_C = 25;

export function temperatureBand(celsius: number): 'cold' | 'mild' | 'warm' {
	if (celsius <= FREEZING_C) return 'cold';
	return celsius >= WARM_C ? 'warm' : 'mild';
}

/** The grid's points are 0.3° of latitude apart, about 33 km (see `fetchGrid` on the server). */
const GRID_SPACING_M = 33_400;
/** Map labels need about this much room between points to stay apart. */
const LABEL_ROOM_PX = 38;

/**
 * The map's starting zoom: RADAR_MAX_ZOOM, or up to one level more (in quarter steps) where the
 * grid would sit closer than LABEL_ROOM_PX. A web map shows more ground per pixel near the
 * equator, so there the same 33 km is fewer pixels and the labels would touch.
 */
export function startZoom(lat: number): number {
	const metresPerPixel = (156_543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** RADAR_MAX_ZOOM;
	const extra = Math.ceil(Math.log2(LABEL_ROOM_PX / (GRID_SPACING_M / metresPerPixel)) * 4) / 4;
	return RADAR_MAX_ZOOM + Math.min(1, Math.max(0, extra));
}

/**
 * The day of the latest satellite picture (M-07) for a place's wall-clock time: NOAA-20 passes
 * around 13:30 local time and NASA publishes within about three hours, so from 17:00 it is
 * today's, before that yesterday's.
 */
export function satelliteDate(placeNow: string): string {
	const date = placeNow.slice(0, 10);
	if (Number(placeNow.slice(11, 13)) >= 17) return date;
	const day = new Date(`${date}T00:00:00Z`);
	day.setUTCDate(day.getUTCDate() - 1);
	return day.toISOString().slice(0, 10);
}

/** NASA GIBS true-colour tiles from NOAA-20's VIIRS for a day; level 9 is their finest. */
export const satelliteTiles = (date: string) =>
	`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
export const SATELLITE_MAX_ZOOM = 9;
