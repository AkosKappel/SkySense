import { error } from '@sveltejs/kit';
import type { ModelRun } from '#lib/models.js';
import type { YearInWeather } from '#lib/year.js';
import { parseCoordinates, type Forecast } from '#lib/weather.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch, url }) => {
	const coordinates = parseCoordinates(params.coords);
	if (!coordinates) error(404, 'Unknown place');

	const query = `lat=${coordinates.lat}&lon=${coordinates.lon}`;
	// `?demo=heat` shows a recorded scenario for screenshots; the server ignores it without fixtures.
	const demo = url.searchParams.get('demo');
	// `?models` compares weather models (C-04); without it, nothing extra is fetched.
	const [response, models] = await Promise.all([
		fetch(`/api/forecast?${query}${demo ? `&demo=${encodeURIComponent(demo)}` : ''}`),
		url.searchParams.has('models')
			? fetch(`/api/models?${query}`).then((r) => (r.ok ? (r.json() as Promise<ModelRun[]>) : null))
			: null
	]);
	if (!response.ok) error(503, 'Weather service unavailable');
	const forecast = (await response.json()) as Forecast;

	// `?year` shows the twelve months before the place's current month (X-13). The month comes
	// from the forecast, so it is the place's, not the reader's or the server's.
	const month = forecast.days[0]?.date.slice(0, 7);
	const year =
		url.searchParams.has('year') && month
			? await fetch(`/api/year?${query}&month=${month}`).then((r) =>
					r.ok ? (r.json() as Promise<YearInWeather | null>) : null
				)
			: null;

	return {
		coordinates,
		name: params.name?.trim().slice(0, 80) || null,
		forecast,
		models,
		year
	};
};
