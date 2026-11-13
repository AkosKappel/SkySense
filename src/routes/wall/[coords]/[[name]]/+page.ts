import { error } from '@sveltejs/kit';
import { parseCoordinates, type Forecast } from '#lib/weather.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const coordinates = parseCoordinates(params.coords);
	if (!coordinates) error(404, 'Unknown place');
	const response = await fetch(`/api/forecast?lat=${coordinates.lat}&lon=${coordinates.lon}`);
	if (!response.ok) error(503, 'Weather service unavailable');
	return {
		coordinates,
		name: params.name?.trim().slice(0, 80) || null,
		forecast: (await response.json()) as Forecast
	};
};
