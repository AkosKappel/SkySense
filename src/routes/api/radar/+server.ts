import { error, json } from '@sveltejs/kit';
import { fetchRadarFrames, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import type { RequestHandler } from './$types';

const MINUTE = 60_000;

// The list of radar frames is the same for every place; RainViewer adds one every 10 minutes.
export const GET: RequestHandler = async ({ fetch, setHeaders }) => {
	try {
		const frames = await memo('radar', 2 * MINUTE, () => fetchRadarFrames(fetch));
		setHeaders({ 'cache-control': 'public, max-age=120, s-maxage=120' });
		return json(frames);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Radar unavailable');
		throw cause;
	}
};
