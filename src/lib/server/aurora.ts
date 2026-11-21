import { SKYSENSE_FIXTURES } from '$app/env/private';
import { z } from 'zod';
import type { Coordinates, Sky } from '#lib/weather.js';
import kpFixture from './fixtures/kp-forecast.json';

// Northern and southern lights (H-07) from NOAA's planetary K-index forecast, public domain, in
// three-hour UTC slots for about three days. A rule of thumb, not an aurora model: the lights reach
// down to about 64° geomagnetic latitude at Kp 0 and some 2.5° further per Kp step, seen low on the
// horizon. NOAA's OVATION model would map the oval itself, if this proves too rough.

const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
/** The geomagnetic north pole of the dipole field (IGRF, 2025). */
const POLE = { lat: 80.8, lon: -72.8 };

const kpSchema = z.array(z.object({ time_tag: z.string(), kp: z.number() }));
export type KpSlot = { start: string; kp: number };

/** NOAA's forecast as slots starting at UTC times "2026-11-21T18:00"; throws when it is unreachable. */
export async function fetchKp(fetchFn: typeof fetch = fetch): Promise<KpSlot[]> {
	let raw: unknown = kpFixture;
	if (!SKYSENSE_FIXTURES) {
		const response = await fetchFn(KP_URL, { signal: AbortSignal.timeout(3000) });
		if (!response.ok) throw new Error(`NOAA Kp forecast: ${response.status}`);
		raw = await response.json();
	}
	return kpSchema.parse(raw).map((slot) => ({ start: slot.time_tag.slice(0, 16), kp: slot.kp }));
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The place's latitude measured from the geomagnetic pole instead of the geographic one. */
export function geomagneticLatitude({ lat, lon }: Coordinates): number {
	const sin =
		Math.sin(radians(lat)) * Math.sin(radians(POLE.lat)) +
		Math.cos(radians(lat)) * Math.cos(radians(POLE.lat)) * Math.cos(radians(lon - POLE.lon));
	return (Math.asin(sin) * 180) / Math.PI;
}

/** The lowest geomagnetic latitude where the lights may show low on the horizon at this Kp. */
const reach = (kp: number) => 64 - 2.5 * kp;

/**
 * The strongest Kp of tonight (18:00 to 06:00 at the place) when the lights may be seen from it,
 * or null. `now` is the place's local time and `utcOffsetSeconds` its offset.
 */
export function auroraTonight(
	slots: KpSlot[],
	coordinates: Coordinates,
	now: string,
	utcOffsetSeconds: number
): Sky['aurora'] {
	const offset = utcOffsetSeconds * 1000;
	const from = Date.parse(`${now.slice(0, 10)}T18:00Z`) - offset;
	const to = from + 12 * 3_600_000;
	const tonight = slots.filter((slot) => {
		const start = Date.parse(`${slot.start}Z`);
		return start + 3 * 3_600_000 > from && start < to;
	});
	if (!tonight.length) return null;
	const kp = Math.max(...tonight.map((slot) => slot.kp));
	const magnetic = geomagneticLatitude(coordinates);
	return Math.abs(magnetic) >= reach(kp)
		? { kp: Math.round(kp * 10) / 10, south: magnetic < 0 }
		: null;
}
