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
