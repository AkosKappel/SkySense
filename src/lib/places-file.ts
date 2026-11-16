// F-22: saved places live only in this browser (D-07), so they can go to a file and back. Kept
// apart from `places.svelte.ts`, which every place page loads, as only the home page needs it.
import { formatCoordinates } from '#lib/weather.js';
import { MAX_PLACES, parsePlaces, savedPlaces } from '#lib/places.svelte.js';

/** The saved places as a file to keep or move to another browser, without "My location". */
export function exportPlaces(): string {
	return JSON.stringify(
		savedPlaces.list.filter((p) => !p.live),
		null,
		'\t'
	);
}

/**
 * Saves the places from an exported file, in the file's order, before the ones already saved;
 * skips those already there and any beyond the limit. "My location" is per device, so it is not
 * imported. Returns how many were added.
 */
export function importPlaces(value: unknown): number {
	const room = MAX_PLACES - savedPlaces.list.filter((p) => !p.live).length;
	const fresh = parsePlaces(value)
		.filter((p) => !p.live && !savedPlaces.has(p))
		.slice(0, Math.max(room, 0))
		.map(({ name, lat, lon, detail }) => ({
			name: name.trim().slice(0, 80) || formatCoordinates({ lat, lon }),
			lat,
			lon,
			...(typeof detail === 'string' && { detail: detail.slice(0, 120) })
		}));
	// `add` puts each place first, so the last one goes in first.
	for (const place of fresh.toReversed()) savedPlaces.add(place);
	return fresh.length;
}
