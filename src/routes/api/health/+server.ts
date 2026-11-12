import { json } from '@sveltejs/kit';
import { version } from '$app/env';
import { fetchForecast } from '#lib/server/open-meteo.js';
import { memo } from '#lib/server/memo.js';
import type { RequestHandler } from './$types';

const MINUTE = 60_000;
/** A place the forecast route sees often, so the check shares its cache entry. */
const PROBE = { lat: 48.15, lon: 17.11 };

/**
 * For the uptime monitor (P-06): 200 when the app can answer a forecast, 503 when Open-Meteo
 * cannot be reached, since the app is of no use without it. Never cached, so each check is real;
 * the forecast itself comes from the shared 10-minute memory cache, so checks add almost no
 * upstream calls.
 */
export const GET: RequestHandler = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		await memo(`forecast:${PROBE.lat},${PROBE.lon}:`, 10 * MINUTE, () =>
			fetchForecast(PROBE, fetch)
		);
		return json({ status: 'ok', version });
	} catch {
		return json({ status: 'degraded', version, upstream: 'open-meteo' }, { status: 503 });
	}
};
