import type { Day, Hour } from '#lib/weather.js';

export type Darkness =
	| { kind: 'sets'; at: string }
	| { kind: 'dark'; sunrise: string | null }
	| { kind: 'polar-night' }
	| { kind: 'midnight-sun' };

/** Answers "When does it get dark?" for the current moment at the place. */
export function darkness(
	now: string,
	today: Day,
	tomorrow: Day | undefined,
	hours: Hour[]
): Darkness {
	if (!today.sunset) {
		const anyDaylight = hours.some((h) => h.time.startsWith(today.date) && h.isDay);
		return anyDaylight ? { kind: 'midnight-sun' } : { kind: 'polar-night' };
	}
	if (now < today.sunset && (!today.sunrise || now >= today.sunrise)) {
		return { kind: 'sets', at: today.sunset };
	}
	const sunrise = now < (today.sunrise ?? '') ? today.sunrise : (tomorrow?.sunrise ?? null);
	return { kind: 'dark', sunrise };
}

const daylightMinutes = (day: Day | undefined) =>
	day?.sunrise && day.sunset
		? (Date.parse(`${day.sunset}Z`) - Date.parse(`${day.sunrise}Z`)) / 60_000
		: null;

/**
 * Today's daylight and how tomorrow's differs (X-21), in whole minutes. Null when either day has
 * no sunrise or sunset (polar night, midnight sun), where a length means nothing.
 */
export function daylightTrend(
	today: Day,
	tomorrow: Day | undefined
): { minutes: number; change: number } | null {
	const now = daylightMinutes(today);
	const next = daylightMinutes(tomorrow);
	if (now === null || next === null) return null;
	return { minutes: now, change: next - now };
}
