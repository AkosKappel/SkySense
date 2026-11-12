// The extra readings of F-23: how the air feels from its dew point, and fog in the next hours.

/** Below this visibility (in metres) the hour counts as foggy, the meteorological definition. */
export const FOG_M = 1000;

/**
 * Whether the air feels sticky, from the dew point in °C: muggy from 16°, oppressive from 20°.
 * Below that it says nothing; a low dew point in fog is not "dry" air, only not muggy.
 */
export function dewComfort(celsius: number): 'muggy' | 'oppressive' | null {
	if (celsius < 16) return null;
	return celsius < 20 ? 'muggy' : 'oppressive';
}

/**
 * The first foggy stretch within the next `within` hours: its first hour and the hour it clears
 * (the first clear hour after it, or the end of the range). Null without fog or visibility data.
 */
export function fogAhead(
	hours: { time: string; visibility?: number }[],
	within = 12
): { from: string; until: string } | null {
	const ahead = hours.slice(0, within);
	const start = ahead.findIndex((h) => h.visibility !== undefined && h.visibility < FOG_M);
	if (start === -1) return null;
	const end = ahead.findIndex(
		(h, i) => i > start && (h.visibility === undefined || h.visibility >= FOG_M)
	);
	const clears = end === -1 ? (hours[ahead.length] ?? ahead.at(-1)!) : ahead[end];
	return { from: ahead[start].time, until: clears.time };
}
