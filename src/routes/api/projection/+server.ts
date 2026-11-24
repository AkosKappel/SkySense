import { error, json } from '@sveltejs/kit';
import { fetchProjection, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { era5Cell } from '#lib/trend.js';
import { parseCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const DAY = 86_400_000;

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	// The models' grid is coarser than ERA5's, so places in one ERA5 cell share an answer.
	const cell = era5Cell(parsed);

	try {
		const projection = await memo(`projection:${cell.lat},${cell.lon}`, DAY, () =>
			fetchProjection(cell, fetch)
		);
		// Model runs do not change: the CDN keeps each cell for a year, as it does the long record.
		setHeaders({ 'cache-control': 'public, max-age=86400, s-maxage=31536000' });
		return json(projection);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
