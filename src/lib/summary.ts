// The plain-language summary (S-01): one sentence about rain or snow in the next 24 hours, and
// one about the most notable other thing (strong gusts, frost, heat), hedged in between when the
// ensemble's runs disagree. Returns keys and raw
// values; each language writes its own whole sentence (AGENTS.md, Languages).
import { STRONG_GUST_KMH } from '#lib/format.js';
import { nextRain, type Hour } from '#lib/weather.js';

export const HOT = 30;
const WINDOW = 24;

type Fall = 'rain' | 'snow' | 'thunder';

export type Sentence =
	| { key: 'dry' }
	| { key: 'later'; fall: Fall; from: string; hours: number }
	| { key: 'rest'; fall: Fall; from: string }
	| { key: 'now'; fall: Fall; until: string }
	| { key: 'all'; fall: Fall }
	| { key: 'gusts'; gust: number; time: string }
	| { key: 'frost'; min: number; time: string }
	| { key: 'heat'; max: number; time: string }
	| { key: 'timingUnsure' }
	| { key: 'dryUnsure' };

/**
 * Below this share of ensemble runs with rain at the hour it starts, the start time is a guess;
 * from this share somewhere in a "dry" day, the dry is not certain either (C-03).
 */
export const RUNS_AGREE = 50;
export const RUNS_SOME = 40;

const hoursBetween = (from: string, until: string) =>
	Math.round((Date.parse(`${until}Z`) - Date.parse(`${from}Z`)) / 3_600_000);

function precipitation(hours: Hour[]): Sentence {
	const rain = nextRain(hours, WINDOW);
	if (!rain) return { key: 'dry' };
	// Sleet reads as rain to someone deciding on an umbrella.
	const fall: Fall = rain.kind === 'mixed' ? 'rain' : rain.kind;
	if (rain.startsNow && rain.openEnded) return { key: 'all', fall };
	if (rain.startsNow) return { key: 'now', fall, until: rain.until };
	if (rain.openEnded) return { key: 'rest', fall, from: rain.from };
	return { key: 'later', fall, from: rain.from, hours: hoursBetween(rain.from, rain.until) };
}

function notable(hours: Hour[], nowTemp: number): Sentence | null {
	const window = hours.slice(0, WINDOW);
	const gustiest = window.reduce((a, b) => (b.gust > a.gust ? b : a));
	if (gustiest.gust >= STRONG_GUST_KMH) {
		return { key: 'gusts', gust: gustiest.gust, time: gustiest.time };
	}
	const frost = window.find((h) => h.temp <= 0);
	if (nowTemp > 0 && frost) {
		return { key: 'frost', min: Math.min(...window.map((h) => h.temp)), time: frost.time };
	}
	// Heat only today: "around 12:00" read at 18:00 would sound like today, not tomorrow.
	const today = window.filter((h) => h.time.startsWith(window[0].time.slice(0, 10)));
	const hottest = today.reduce((a, b) => (b.temp > a.temp ? b : a));
	if (hottest.temp >= HOT) return { key: 'heat', max: hottest.temp, time: hottest.time };
	return null;
}

/** Hedges when the ensemble's runs disagree with the sentence; says nothing when they agree. */
function hedge(hours: Hour[], first: Sentence): Sentence | null {
	if (first.key === 'later' || first.key === 'rest') {
		const start = hours.find((h) => h.time === first.from);
		if (start?.spread && start.spread.rain < RUNS_AGREE) return { key: 'timingUnsure' };
	}
	if (first.key === 'dry') {
		const most = Math.max(...hours.slice(0, WINDOW).map((h) => h.spread?.rain ?? 0));
		if (most >= RUNS_SOME) return { key: 'dryUnsure' };
	}
	return null;
}

/** `hours` start at the current hour. */
export function summarize(hours: Hour[], nowTemp: number): Sentence[] {
	if (!hours.length) return [];
	const first = precipitation(hours);
	return [first, hedge(hours, first), notable(hours, nowTemp)].filter((s) => s !== null);
}
