// The sea at coastal places (X-18): today's highest waves and the water's temperature, from
// Open-Meteo's Marine API. Inland its grid has no sea, and the wind tile says nothing about it.

export type MarineHour = { time: string; waves: number | null; temp: number | null };

export type Sea = {
	/** The highest significant wave height left today, in metres, and its hour. */
	highest: { height: number; time: string };
	/** Sea surface temperature now, in °C, where the model has it. */
	temp: number | null;
};

/** From the current hour to the end of its day; null where the hour has no waves (inland). */
export function seaToday(hours: MarineHour[], now: string): Sea | null {
	const hour = `${now.slice(0, 13)}:00`;
	const rest = hours.filter((h) => h.time >= hour && h.time.startsWith(now.slice(0, 10)));
	const first = rest[0];
	if (first?.waves == null) return null;
	const highest = rest.reduce(
		(top, h) =>
			h.waves !== null && h.waves > top.height ? { height: h.waves, time: h.time } : top,
		{ height: first.waves, time: first.time }
	);
	return { highest, temp: first.temp };
}

/** The Douglas sea scale, by significant wave height in metres; "smooth" counts as calm. */
export function seaState(metres: number): 'calm' | 'slight' | 'moderate' | 'rough' | 'veryRough' {
	if (metres < 0.5) return 'calm';
	if (metres < 1.25) return 'slight';
	if (metres < 2.5) return 'moderate';
	if (metres < 4) return 'rough';
	return 'veryRough';
}
