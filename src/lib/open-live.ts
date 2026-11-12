// Opening the live "My location" entry (F-12): locate again, and fall back to the last position
// when that fails or takes too long, so the link always leads somewhere.
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { locate } from '#lib/locate.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { savedPlaces, type SavedPlace } from '#lib/places.svelte.js';
import { formatCoordinates, roundCoordinates, type Coordinates } from '#lib/weather.js';

/** The town's name at a position from our server, or undefined when there is none or it fails. */
export async function areaName(position: Coordinates): Promise<string | undefined> {
	const { lat, lon } = roundCoordinates(position);
	try {
		const response = await fetch(`/api/reverse?lat=${lat}&lon=${lon}&lang=${getLocale()}`, {
			signal: AbortSignal.timeout(3000)
		});
		if (!response.ok) return undefined;
		const { name } = (await response.json()) as { name: string | null };
		return name ?? undefined;
	} catch {
		return undefined;
	}
}

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
	let area = place.detail;
	try {
		position = await locate(5000);
		area = await areaName(position);
		savedPlaces.setLive({ name, detail: area, ...position });
	} catch {
		// Denied, unavailable or slow: the last position it is.
	}
	await goto(
		resolve('/p/[coords]/[[name]]', {
			coords: formatCoordinates(position),
			name: encodeURIComponent(area ?? name)
		}),
		{ replaceState: replace }
	);
}
