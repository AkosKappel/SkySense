import { redirect } from '@sveltejs/kit';
import { LAST_PLACE_COOKIE, parseLastPlace } from '#lib/places.svelte.js';
import { skyKind, type SkyKind } from '#lib/sky.js';
import { summarize, type Sentence } from '#lib/summary.js';
import type { Condition, Forecast } from '#lib/weather.js';
import type { PageServerLoad } from './$types';

/** Three climates for the home page's live answers: central Europe, the south, the Arctic. */
const SAMPLES = [
	{ name: 'Bratislava', coords: '48.15,17.11' },
	{ name: 'Madrid', coords: '40.42,-3.7' },
	{ name: 'Tromsø', coords: '69.65,18.96' }
];

export type Sample = {
	name: string;
	coords: string;
	sentences: Sentence[];
	temp: number;
	condition: Condition;
	isDay: boolean;
	sky: SkyKind;
};

// `/` reopens the last place, so a returning visitor lands on their forecast. `?choose` shows the
// home page with the place picker. The samples stream in after the page, so it never waits on them.
export const load: PageServerLoad = ({ cookies, url, fetch }) => {
	if (!url.searchParams.has('choose')) {
		const last = parseLastPlace(cookies.get(LAST_PLACE_COOKIE));
		if (last) redirect(307, `/p/${last.coords}/${encodeURIComponent(last.name)}`);
	}
	const samples = Promise.all(
		SAMPLES.map(async ({ name, coords }): Promise<Sample | null> => {
			const [lat, lon] = coords.split(',');
			const response = await fetch(`/api/forecast?lat=${lat}&lon=${lon}`);
			if (!response.ok) return null;
			const forecast = (await response.json()) as Forecast;
			const { current: now } = forecast;
			return {
				name,
				coords,
				sentences: summarize(forecast.hours, now.temp),
				temp: now.temp,
				condition: now.condition,
				isDay: now.isDay,
				sky: skyKind(now, forecast.days[0])
			};
		})
	).then((list) => list.filter((sample) => sample !== null));
	return { samples };
};
