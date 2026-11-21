// What about tomorrow? Tomorrow's high against today's, and the rain, snow or storms of its waking
// hours. Returns keys and values; each language writes its own sentences.
import { nextRain, type Day, type Hour } from '#lib/weather.js';

/** Highs this close (°C) read as "about the same as today". */
export const SAME_WITHIN = 2;
/** The hours that matter for plans: 06:00 to 22:00. */
const WAKING_FROM = 6;
const WAKING_UNTIL = 22;

export type Fall = 'rain' | 'snow' | 'thunder';

export type Outlook = {
	day: Day;
	/** For the icon: the first wet waking hour, or midday, so it matches the sentence. */
	condition: Hour['condition'];
	temp: { key: 'warmer' | 'colder' | 'same'; diff: number };
	fall:
		| { key: 'dry' }
		| { key: 'from'; kind: Fall; from: string }
		| { key: 'window'; kind: Fall; from: string; until: string };
};

/** `days` start today; `hours` reach at least to the end of tomorrow. */
export function tomorrowOutlook(days: Day[], hours: Hour[]): Outlook | null {
	const [today, tomorrow] = days;
	if (!today || !tomorrow) return null;
	const waking = hours.filter((h) => {
		const hour = Number(h.time.slice(11, 13));
		return h.time.startsWith(tomorrow.date) && hour >= WAKING_FROM && hour <= WAKING_UNTIL;
	});
	if (!waking.length) return null;

	const diff = tomorrow.max - today.max;
	const key = Math.abs(diff) < SAME_WITHIN ? 'same' : diff > 0 ? 'warmer' : 'colder';

	const rain = nextRain(waking, waking.length);
	// Sleet reads as rain to someone deciding on an umbrella, as in the summary.
	const kind: Fall | null = rain ? (rain.kind === 'mixed' ? 'rain' : rain.kind) : null;
	const fall: Outlook['fall'] =
		!rain || !kind
			? { key: 'dry' }
			: rain.openEnded
				? { key: 'from', kind, from: rain.from }
				: { key: 'window', kind, from: rain.from, until: rain.until };

	const shown = rain
		? waking.find((h) => h.time === rain.from)!
		: (waking.find((h) => h.time.endsWith('T12:00')) ?? waking[0]);

	return { day: tomorrow, condition: shown.condition, temp: { key, diff: Math.abs(diff) }, fall };
}
