import {
	formatDate,
	formatHour,
	formatMonth,
	formatPastDate,
	formatTime,
	formatWeekday,
	intlLocale
} from '#lib/time.js';
import { formatPressure, formatRain, formatWind, temperature, type Units } from '#lib/units.js';

/** Formatting bound to the reader's language and units, for components. */
export function formatter(locale: string, units: Units) {
	const intl = intlLocale(locale, units.clock);
	return {
		temp: (celsius: number) => `${temperature(celsius, units)}°`,
		/** A difference between two temperatures: scaled, not shifted, for Fahrenheit. */
		tempDelta: (celsius: number) =>
			`${Math.round(units.temperature === 'f' ? celsius * 1.8 : celsius)}°`,
		time: (local: string) => formatTime(local, intl, units.clock),
		hour: (local: string) => formatHour(local, intl, units.clock),
		weekday: (date: string) => formatWeekday(date, intl),
		date: (date: string) => formatDate(date, intl),
		pastDate: (date: string) => formatPastDate(date, intl),
		month: (month: string, withYear = false) => formatMonth(month, intl, withYear),
		wind: (kmh: number) => formatWind(kmh, units),
		rain: (mm: number) => formatRain(mm, units, intl),
		pressure: (hpa: number) => formatPressure(hpa, units, intl),
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

export const compassPoints = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

/** The compass point a wind comes from, from its direction in degrees (meteorological: 0 is north). */
export function compass(degrees: number): (typeof compassPoints)[number] {
	const normalized = ((degrees % 360) + 360) % 360;
	return compassPoints[Math.round(normalized / 45) % 8];
}

/** Gusts from this speed get a warning line. */
export const STRONG_GUST_KMH = 60;
