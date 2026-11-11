// The summary's sentences as text in the reader's language, shared by the summary line and the
// share card (X-04).
import type { Formatter } from '#lib/format.js';
import { m } from '#lib/paraglide/messages.js';
import type { Sentence } from '#lib/summary.js';

const fall = {
	rain: {
		later: m.summary_rain_later,
		rest: m.summary_rain_rest,
		now: m.summary_rain_now,
		all: m.summary_rain_all
	},
	snow: {
		later: m.summary_snow_later,
		rest: m.summary_snow_rest,
		now: m.summary_snow_now,
		all: m.summary_snow_all
	},
	thunder: {
		later: m.summary_thunder_later,
		rest: m.summary_thunder_rest,
		now: m.summary_thunder_now,
		all: m.summary_thunder_all
	}
};

/** "10:00" today, "Wed 10:00" tomorrow, so "around 10:00" read at 18:00 is not misread. */
const when = (time: string, today: boolean, f: Formatter) =>
	today ? f.time(time) : `${f.weekday(time.slice(0, 10))} ${f.time(time)}`;

function say(s: Sentence, f: Formatter): string {
	switch (s.key) {
		case 'dry':
			return m.summary_dry();
		case 'later':
			return fall[s.fall].later({ from: f.time(s.from), hours: s.hours });
		case 'rest':
			return fall[s.fall].rest({ from: f.time(s.from) });
		case 'now':
			return fall[s.fall].now({ until: f.time(s.until) });
		case 'all':
			return fall[s.fall].all();
		case 'gusts':
			return m.summary_gusts({ gust: f.wind(s.gust), time: when(s.time, s.today, f) });
		case 'frost':
			return m.summary_frost({ min: f.temp(s.min), time: when(s.time, s.today, f) });
		case 'heat':
			return m.summary_heat({ max: f.temp(s.max), time: f.time(s.time) });
		case 'timingUnsure':
			return m.summary_timing_unsure();
		case 'dryUnsure':
			return m.summary_dry_unsure();
	}
}

export function summaryText(sentences: Sentence[], f: Formatter): string {
	return sentences.map((s) => say(s, f)).join(' ');
}
