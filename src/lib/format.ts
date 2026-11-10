import { formatDate, formatHour, formatTime, formatWeekday, intlLocale } from '#lib/time.js';
import { formatRain, formatWind, temperature, type Units } from '#lib/units.js';

/** Formatting bound to the reader's language and units, for components. */
export function formatter(locale: string, units: Units) {
	const intl = intlLocale(locale, units.clock);
	return {
		temp: (celsius: number) => `${temperature(celsius, units)}°`,
		time: (local: string) => formatTime(local, intl, units.clock),
		hour: (local: string) => formatHour(local, intl, units.clock),
		weekday: (date: string) => formatWeekday(date, intl),
		date: (date: string) => formatDate(date, intl),
		wind: (kmh: number) => formatWind(kmh, units),
		rain: (mm: number) => formatRain(mm, units),
		percent: (value: number) =>
			new Intl.NumberFormat(intl, { style: 'percent' }).format(value / 100)
	};
}

export type Formatter = ReturnType<typeof formatter>;

export function windLevel(beaufortForce: number): 'calm' | 'light' | 'breezy' | 'windy' | 'stormy' {
	if (beaufortForce <= 1) return 'calm';
	if (beaufortForce <= 3) return 'light';
	if (beaufortForce <= 5) return 'breezy';
	if (beaufortForce <= 7) return 'windy';
	return 'stormy';
}

export function uvLevel(index: number): 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme' {
	if (index < 3) return 'low';
	if (index < 6) return 'moderate';
	if (index < 8) return 'high';
	if (index < 11) return 'veryHigh';
	return 'extreme';
}
