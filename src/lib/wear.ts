// What to wear (X-02): a clothing line from the coldest feels-like of the next waking hours,
// shifted by the comfort profile, with extras for rain, strong wind and strong sun.
import { STRONG_GUST_KMH } from '#lib/format.js';
import { RAIN_LIKELY, type Hour } from '#lib/weather.js';

export type Layer = 'tshirt' | 'layer' | 'light' | 'warm' | 'winter' | 'arctic';
export type Extra = 'rain' | 'wind' | 'sun';

const HOURS = 12;
/** UV from which sunglasses and sun cream are worth a mention (WHO "high"). */
const STRONG_SUN = 6;

/** Feels-like thresholds in °C, warmest first; a temperature at or above one gets its layer. */
const layers: [number, Layer][] = [
	[24, 'tshirt'],
	[17, 'layer'],
	[10, 'light'],
	[3, 'warm'],
	[-5, 'winter']
];

/** `hours` start now; `shift` is the comfort profile's (3 for someone who gets cold easily). */
export function whatToWear(hours: Hour[], shift = 0): { layer: Layer; extras: Extra[] } | null {
	const next = hours.slice(0, HOURS);
	// Nobody dresses for 03:00; at night the coming hours are all there is.
	const awake = next.filter((h) => {
		const hour = Number(h.time.slice(11, 13));
		return hour >= 6 && hour < 23;
	});
	const window = awake.length ? awake : next;
	if (!window.length) return null;

	const coldest = Math.min(...window.map((h) => h.feels)) - shift;
	const layer = layers.find(([from]) => coldest >= from)?.[1] ?? 'arctic';
	const extras: Extra[] = [];
	if (window.some((h) => h.rainChance >= RAIN_LIKELY)) extras.push('rain');
	if (window.some((h) => h.gust >= STRONG_GUST_KMH)) extras.push('wind');
	if (window.some((h) => h.uv >= STRONG_SUN)) extras.push('sun');
	return { layer, extras };
}
