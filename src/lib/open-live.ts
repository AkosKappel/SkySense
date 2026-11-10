// Opening the live "My location" entry (F-12): locate again, and fall back to the last position
// when that fails or takes too long, so the link always leads somewhere.
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { locate } from '#lib/locate.js';
import { savedPlaces, type SavedPlace } from '#lib/places.svelte.js';
import { formatCoordinates } from '#lib/weather.js';

export async function openLive(
	event: MouseEvent,
	place: SavedPlace,
	name: string,
	replace = false
) {
	// A new tab or window keeps the link's last position.
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return;
	event.preventDefault();
	let position = { lat: place.lat, lon: place.lon };
	try {
		position = await locate(5000);
		savedPlaces.setLive({ name, ...position });
	} catch {
		// Denied, unavailable or slow: the last position it is.
	}
	await goto(
		resolve('/p/[coords]/[[name]]', {
			coords: formatCoordinates(position),
			name: encodeURIComponent(name)
		}),
		{ replaceState: replace }
	);
}
