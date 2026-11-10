import { error, json } from '@sveltejs/kit';
import { isLocale } from '#lib/paraglide/runtime.js';
import { searchPlaces, WeatherServiceError } from '#lib/server/open-meteo.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const query = (url.searchParams.get('q') ?? '').trim();
	const language = url.searchParams.get('lang') ?? 'en';
	if (query.length < 2 || query.length > 80) error(400, 'q must be 2 to 80 characters');
	if (!isLocale(language)) error(400, 'lang must be a supported language');

	try {
		const places = await searchPlaces(query, language, fetch);
		setHeaders({ 'cache-control': 'public, max-age=3600, s-maxage=86400, stale-if-error=604800' });
		return json(places);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Place search unavailable');
		throw cause;
	}
};
