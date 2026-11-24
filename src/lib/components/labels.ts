// Labels are functions, called where they are shown: the server renders each request in its own
// language, so a module-level constant would freeze one language.
import { m } from '#lib/paraglide/messages.js';
import type { ActivityId } from '#lib/activities.js';
import type { Formatter } from '#lib/format.js';
import type { RainAhead } from '#lib/nowcast.js';
import type { Outlook } from '#lib/tomorrow.js';
import type { Extra, Layer } from '#lib/wear.js';
import type { Condition } from '#lib/weather.js';

export function conditionLabel(condition: Condition, isDay = true): string {
	switch (condition) {
		case 'clear':
			return isDay ? m.cond_sunny() : m.cond_clear();
		case 'partly':
			return m.cond_partly();
		case 'cloudy':
			return m.cond_cloudy();
		case 'fog':
			return m.cond_fog();
		case 'drizzle':
			return m.cond_drizzle();
		case 'rain':
			return m.cond_rain();
		case 'showers':
			return m.cond_showers();
		case 'snow':
			return m.cond_snow();
		case 'thunder':
			return m.cond_thunder();
	}
}

const activityNames: Record<ActivityId, () => string> = {
	run: m.activity_run,
	cycle: m.activity_cycle,
	walk: m.activity_walk,
	hike: m.activity_hike,
	picnic: m.activity_picnic,
	laundry: m.activity_laundry,
	stars: m.activity_stars,
	golden: m.activity_golden
};

export function activityLabel(id: ActivityId): string {
	return activityNames[id]();
}

/** Tomorrow in two sentences (F-29): its warmth against today's, then its rain, snow or storms. */
export function tomorrowText(outlook: Outlook, f: Formatter): string {
	const max = f.temp(outlook.day.max);
	const temp = { warmer: m.tomorrow_warmer, colder: m.tomorrow_colder, same: m.tomorrow_same }[
		outlook.temp.key
	]({ max });
	const fall = outlook.fall;
	if (fall.key === 'dry') return `${temp} ${m.tomorrow_dry()}`;
	if (fall.key === 'from') {
		const from = {
			rain: m.tomorrow_rain_from,
			snow: m.tomorrow_snow_from,
			thunder: m.tomorrow_thunder_from
		};
		return `${temp} ${from[fall.kind]({ from: f.time(fall.from) })}`;
	}
	const window = {
		rain: m.tomorrow_rain_window,
		snow: m.tomorrow_snow_window,
		thunder: m.tomorrow_thunder_window
	};
	return `${temp} ${window[fall.kind]({ from: f.time(fall.from), until: f.time(fall.until) })}`;
}

/** When rain starts or stops (M-02, F-32): to the quarter hour where a model runs at that step. */
export function rainAheadText(found: RainAhead, snow: boolean, f: Formatter): string {
	const time = f.time(found.at);
	if (!found.quarter) {
		return found.turn === 'starts' ? m.wall_rain_from({ time }) : m.wall_dry_from({ time });
	}
	if (found.turn === 'starts')
		return snow ? m.nowcast_snow_starts({ time }) : m.nowcast_starts({ time });
	return snow ? m.nowcast_snow_stops({ time }) : m.nowcast_stops({ time });
}

/** What to wear (X-02), as `whatToWear` answers it, in a line. */
export function wearText(
	wear: { layer: Layer; extras: Extra[]; shedFrom?: string },
	f: Formatter
): string {
	const layers: Record<Layer, () => string> = {
		tshirt: m.wear_tshirt,
		layer: m.wear_layer,
		light: m.wear_light,
		warm: m.wear_warm,
		winter: m.wear_winter,
		arctic: m.wear_arctic
	};
	const extras: Record<Extra, () => string> = {
		rain: m.wear_rain,
		wind: m.wear_wind,
		sun: m.wear_sun
	};
	return [
		layers[wear.layer](),
		...(wear.shedFrom ? [m.wear_shed({ time: f.time(wear.shedFrom) })] : []),
		...wear.extras.map((extra) => extras[extra]())
	].join(' ');
}
