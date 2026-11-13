import type { Coordinates } from '#lib/weather.js';

/**
 * Points around a place, `steps` on each side: rows north to south, columns west to east, spaced
 * evenly in km (the longitude step widens away from the equator).
 */
export function gridPoints(
	{ lat, lon }: Coordinates,
	steps: number,
	degrees: number
): Coordinates[] {
	const lonStep = degrees / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
	const points: Coordinates[] = [];
	for (let i = steps; i >= -steps; i--) {
		for (let j = -steps; j <= steps; j++) {
			points.push({
				lat: Math.round((lat + i * degrees) * 100) / 100,
				lon: Math.round((lon + j * lonStep) * 100) / 100
			});
		}
	}
	return points;
}
