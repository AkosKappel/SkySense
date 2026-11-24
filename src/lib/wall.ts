import type { Hour } from '#lib/weather.js';

/** The place's wall-clock time as `YYYY-MM-DDTHH:MM`, the form the forecast's times use. */
export function placeNow(utcOffsetSeconds: number, nowMs: number): string {
	return new Date(nowMs + utcOffsetSeconds * 1000).toISOString().slice(0, 16);
}

/** The hours from the current one on, so a wall left offline does not show hours gone by. */
export function upcoming(hours: Hour[], localNow: string): Hour[] {
	const thisHour = `${localNow.slice(0, 13)}:00`;
	return hours.filter((hour) => hour.time >= thisHour);
}

/**
 * A few pixels' shift that changes every hour and repeats every nine, so a screen left on all
 * day never shows the same pixels for long (burn-in on OLED and old LCD panels).
 */
export function burnInShift(hour: number): { x: number; y: number } {
	const step = 4;
	return { x: ((hour % 3) - 1) * step, y: ((Math.floor(hour / 3) % 3) - 1) * step };
}

/**
 * What a wall shows (F-31), from its address: `?show=clock&show=now&size=l`. The address is the
 * setting, so each screen keeps its own as a bookmark and a layout can be sent to another device.
 * The blocks keep this order; the first three form the big column in landscape.
 */
export const wallBlocks = [
	'clock',
	'date',
	'now',
	'sentence',
	'umbrella',
	'readings',
	'hours',
	'tomorrow'
] as const;
export type WallBlock = (typeof wallBlocks)[number];
export const heroBlocks: readonly WallBlock[] = ['clock', 'date', 'now'];
export const wallSizes = ['s', 'm', 'l'] as const;
export type WallSize = (typeof wallSizes)[number];
export type WallLayout = { blocks: WallBlock[]; size: WallSize };

export const wallPresets = {
	/** What the wall showed before it could be set up. */
	standard: ['clock', 'date', 'now', 'sentence', 'umbrella', 'readings', 'hours'],
	clock: ['clock', 'date', 'now'],
	forecast: ['now', 'umbrella', 'hours', 'tomorrow'],
	everything: [...wallBlocks]
} satisfies Record<string, WallBlock[]>;

export function wallLayout(params: Pick<URLSearchParams, 'get' | 'getAll'>): WallLayout {
	const chosen = new Set(params.getAll('show'));
	const blocks = wallBlocks.filter((block) => chosen.has(block));
	const size = wallSizes.find((s) => s === params.get('size')) ?? 'm';
	return { blocks: blocks.length ? blocks : [...wallPresets.standard], size };
}

/** The address of a layout, the default parts left out so a plain wall keeps its plain address. */
export function wallQuery({ blocks, size }: WallLayout): string {
	const params = new URLSearchParams();
	const standard = blocks.join() === wallPresets.standard.join();
	if (!standard) for (const block of blocks) params.append('show', block);
	if (size !== 'm') params.set('size', size);
	const query = params.toString();
	return query ? `?${query}` : '';
}

/** After the place's sunset and before midnight, tomorrow is what people ask about. */
export const isEvening = (localNow: string, sunset: string | null) =>
	sunset !== null && localNow >= sunset && localNow.slice(0, 10) === sunset.slice(0, 10);
