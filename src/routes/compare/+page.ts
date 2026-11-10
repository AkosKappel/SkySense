import { error } from '@sveltejs/kit';
import { parseCoordinates, type Forecast } from '#lib/weather.js';
import type { PageLoad } from './$types';

// `/compare?a=48.15,17.11&an=Bratislava&b=48.21,16.37&bn=Vienna` (X-07).
export const load: PageLoad = async ({ url, fetch }) => {
	const place = (key: 'a' | 'b') => {
		const coordinates = parseCoordinates(url.searchParams.get(key) ?? '');
		if (!coordinates) error(404, 'Unknown place');
		return { ...coordinates, name: url.searchParams.get(`${key}n`)?.trim().slice(0, 80) || null };
	};
	const a = place('a');
	const b = place('b');
	const [forecastA, forecastB] = await Promise.all(
		[a, b].map(async ({ lat, lon }) => {
			const response = await fetch(`/api/forecast?lat=${lat}&lon=${lon}`);
			if (!response.ok) error(503, 'Weather service unavailable');
			return (await response.json()) as Forecast;
		})
	);
	return { a, b, forecastA, forecastB };
};
