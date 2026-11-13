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
