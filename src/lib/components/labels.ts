// Labels are functions, called where they are shown: the server renders each request in its own
// language, so a module-level constant would freeze one language.
import { m } from '#lib/paraglide/messages.js';
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
