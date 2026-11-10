// Units live in a cookie, not localStorage, so the server renders the first paint in them.
import { imperial, metric, unitChoices, type Units } from '#lib/units.js';

export const UNITS_COOKIE = 'skysense_units';

/** Defaults follow the browser: the United States and Liberia use Fahrenheit, everyone else Celsius. */
export function defaultUnits(acceptLanguage: string | null): Units {
	const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
	return first === 'en-us' || first === 'en-lr' ? imperial : metric;
}

/** Reads the cookie leniently: an unknown or missing value falls back to the default for that unit. */
export function readUnits(cookie: string | undefined, fallback: Units): Units {
	let stored: Record<string, unknown> = {};
	try {
		const parsed: unknown = cookie ? JSON.parse(cookie) : {};
		if (parsed && typeof parsed === 'object') stored = parsed as Record<string, unknown>;
	} catch {
		// A damaged cookie means defaults.
	}
	const pick = <K extends keyof Units>(key: K): Units[K] => {
		const value = stored[key as string];
		return (unitChoices[key] as readonly unknown[]).includes(value)
			? (value as Units[K])
			: fallback[key];
	};
	return {
		temperature: pick('temperature'),
		wind: pick('wind'),
		rain: pick('rain'),
		clock: pick('clock')
	};
}
