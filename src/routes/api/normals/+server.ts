import { error, json } from '@sveltejs/kit';
import { fetchNormals, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { parseCoordinates, roundCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const DAY = 86_400_000;

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const coordinates = roundCoordinates(parsed);

	try {
		const normals = await memo(`normals:${coordinates.lat},${coordinates.lon}`, DAY, () =>
			fetchNormals(coordinates, fetch)
		);
		// 1991 to 2020 never changes: one heavy archive request per place, then the CDN answers.
		setHeaders({ 'cache-control': 'public, max-age=86400, s-maxage=2592000' });
		return json(normals);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
