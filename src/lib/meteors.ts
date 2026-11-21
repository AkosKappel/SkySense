// The major meteor showers (H-07): the evening that starts each peak night and the rate under a
// dark sky (the IMO's zenithal hourly rate). Peaks move by about a day between years; the table
// keeps the usual night, which is close enough for "tonight" or "tomorrow night".

export const showers = [
	{ id: 'quadrantids', night: '01-03', rate: 110 },
	{ id: 'lyrids', night: '04-21', rate: 18 },
	{ id: 'etaAquariids', night: '05-05', rate: 50 },
	{ id: 'deltaAquariids', night: '07-29', rate: 25 },
	{ id: 'perseids', night: '08-12', rate: 100 },
	{ id: 'orionids', night: '10-20', rate: 20 },
	{ id: 'leonids', night: '11-16', rate: 15 },
	{ id: 'geminids', night: '12-13', rate: 150 }
] as const;

export type Shower = (typeof showers)[number];

/** A shower that peaks tonight (`days` 0) or tomorrow night (1), for the place's date "2026-12-13". */
export function meteorPeak(today: string): { shower: Shower; days: 0 | 1 } | null {
	const tomorrow = new Date(Date.parse(`${today}T00:00Z`) + 86_400_000).toISOString();
	for (const shower of showers) {
		if (today.slice(5) === shower.night) return { shower, days: 0 };
		if (tomorrow.slice(5, 10) === shower.night) return { shower, days: 1 };
	}
	return null;
}

/** Cloud cover from this much, on average, hides most of the night sky. */
export const CLOUDY_NIGHT = 75;

/**
 * Mean cloud cover from 22:00 on `date` to 03:00 the next morning, for whether a shower, the
 * planets or the aurora can be seen; null when the forecast has no cloud cover for those hours.
 */
export function nightClouds(
	hours: { time: string; clouds?: number }[],
	date: string
): number | null {
	const next = new Date(Date.parse(`${date}T00:00Z`) + 86_400_000).toISOString().slice(0, 10);
	const from = `${date}T22:00`;
	const to = `${next}T03:00`;
	const clouds = hours
		.filter((h) => h.time >= from && h.time <= to && h.clouds !== undefined)
		.map((h) => h.clouds!);
	return clouds.length ? clouds.reduce((a, b) => a + b, 0) / clouds.length : null;
}
