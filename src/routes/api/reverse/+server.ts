import { error, json } from '@sveltejs/kit';
import { isLocale } from '#lib/paraglide/runtime.js';
import { memo } from '#lib/server/memo.js';
import { reverseGeocode, WeatherServiceError } from '#lib/server/open-meteo.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const DAY = 86_400_000;

/** The town or city name for "My location" (F-12); `{ name: null }` where there is none. */
export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const language = url.searchParams.get('lang') ?? 'en';
	if (!isLocale(language)) error(400, 'lang must be a supported language');
	const coordinates = roundCoordinates(parsed);

	try {
		const name = await memo(`reverse:${coordinates.lat},${coordinates.lon}:${language}`, DAY, () =>
			reverseGeocode(coordinates, language, fetch)
		);
		// Place names rarely change, and a long CDN life keeps Nominatim's traffic low.
		setHeaders({
			'cache-control': 'public, max-age=86400, s-maxage=2592000, stale-if-error=604800'
		});
		return json({ name });
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Reverse geocoding unavailable');
		throw cause;
	}
};
