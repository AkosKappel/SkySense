// The answers above the wind and UV charts (U-24): the strongest gust and the strongest sun in
// the hours shown.
import type { Hour } from '#lib/weather.js';

/** The hour with the strongest gust (the first of equals). */
export function strongestGust(hours: Hour[]): Hour | null {
	return hours.reduce<Hour | null>((best, h) => (!best || h.gust > best.gust ? h : best), null);
}

/** UV that rounds to 1 or more is worth a chart, as today's details show it as 1. */
const UV_WORTH = 0.5;

/** The daylight hours, and the one with the highest UV, or null when the sun stays too low. */
export function sunHours(hours: Hour[]): { hours: Hour[]; peak: Hour } | null {
	const day = hours.filter((h) => h.isDay);
	const peak = day.reduce<Hour | null>((best, h) => (!best || h.uv > best.uv ? h : best), null);
	return peak && peak.uv >= UV_WORTH ? { hours: day, peak } : null;
}
