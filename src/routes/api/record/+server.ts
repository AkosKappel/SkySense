import { error, json } from '@sveltejs/kit';
import { fetchRecord, WeatherServiceError } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import { era5Cell } from '#lib/trend.js';
import { parseCoordinates } from '#lib/weather.js';
import type { RequestHandler } from './$types';

const DAY = 86_400_000;
/** ERA5 runs about five days behind, so a year is whole from about 6 January on; ten days is safe. */
const ERA5_SETTLED_MS = 10 * DAY;

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = parseCoordinates(
		`${url.searchParams.get('lat') ?? ''},${url.searchParams.get('lon') ?? ''}`
	);
	if (!parsed) error(400, 'lat and lon must be valid coordinates');
	const cell = era5Cell(parsed);
	// `until` is in the URL so the CDN's year-long copy ends when a new year joins the record. The
	// place's date and this clock may differ around 10 January, so the year before is fine too.
	const whole = new Date(Date.now() - ERA5_SETTLED_MS).getUTCFullYear() - 1;
	const lastYear = Number(url.searchParams.get('until'));
	if (lastYear !== whole && lastYear !== whole - 1) error(400, `until must be ${whole}`);

	try {
		const record = await memo(`record:${cell.lat},${cell.lon}:${lastYear}`, DAY, () =>
			fetchRecord(cell, lastYear, fetch)
		);
		// The heaviest request the app makes (decision 0002): whole past years never change, so the
		// CDN keeps each cell's answer for a year, until a new year joins the record.
		setHeaders({ 'cache-control': 'public, max-age=86400, s-maxage=31536000' });
		return json(record);
	} catch (cause) {
		if (cause instanceof WeatherServiceError) error(502, 'Weather service unavailable');
		throw cause;
	}
};
