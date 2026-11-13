import { error } from '@sveltejs/kit';
import { parseCoordinates, type Forecast } from '#lib/weather.js';

/** A place from its route params and its forecast, for the pages around one place (embed, wall, map). */
export async function loadPlace(
	params: { coords: string; name?: string },
	fetch: typeof globalThis.fetch
) {
	const coordinates = parseCoordinates(params.coords);
	if (!coordinates) error(404, 'Unknown place');
	const response = await fetch(`/api/forecast?lat=${coordinates.lat}&lon=${coordinates.lon}`);
	if (!response.ok) error(503, 'Weather service unavailable');
	return {
		coordinates,
		name: params.name?.trim().slice(0, 80) || null,
		forecast: (await response.json()) as Forecast
	};
}
