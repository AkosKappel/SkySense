import {
	formatDate,
	formatHour,
	formatMonth,
	formatPastDate,
	formatTime,
	formatWeekday,
	intlLocale
} from '#lib/time.js';
import {
	formatDistance,
	formatElevation,
	formatPressure,
	formatRain,
	formatSnow,
	formatWaves,
	formatWind,
	temperature,
	windSpeed,
	type Units
} from '#lib/units.js';

/** Formatting bound to the reader's language and units, for components. */
export function formatter(locale: string, units: Units) {
	const intl = intlLocale(locale, units.clock);
	return {
		/** The `Intl` locale, for formats only one view needs. */
		locale: intl,
		temp: (celsius: number) => `${temperature(celsius, units)}°`,
		/** A difference between two temperatures: scaled, not shifted, for Fahrenheit. */
		tempDelta: (celsius: number, fractionDigits = 0) =>
			`${new Intl.NumberFormat(intl, { maximumFractionDigits: fractionDigits }).format(units.temperature === 'f' ? celsius * 1.8 : celsius)}°`,
		time: (local: string) => formatTime(local, intl, units.clock),
		hour: (local: string) => formatHour(local, intl, units.clock),
		/** An hour that stands alone, not on a chart's axis: "22:00" rather than "22", or "10 PM". */
		clockHour: (local: string) =>
			units.clock === '24' ? formatTime(local, intl, '24') : formatHour(local, intl, '12'),
		weekday: (date: string) => formatWeekday(date, intl),
		date: (date: string) => formatDate(date, intl),
		pastDate: (date: string) => formatPastDate(date, intl),
		month: (month: string, withYear = false) => formatMonth(month, intl, withYear),
		wind: (kmh: number) => formatWind(kmh, units),
		/** The wind's number alone, for labels on a map whose legend names the unit. */
		windValue: (kmh: number) => windSpeed(kmh, units),
		rain: (mm: number) => formatRain(mm, units, intl),
		snow: (cm: number) => formatSnow(cm, units, intl),
		waves: (metres: number) => formatWaves(metres, units, intl),
		elevation: (metres: number) => formatElevation(metres, units, intl),
		pressure: (hpa: number) => formatPressure(hpa, units, intl),
		distance: (metres: number) => formatDistance(metres, units, intl),
		/** A length of time: "9 hrs, 32 mins". */
		duration: (minutes: number) =>
			new Intl.DurationFormat(intl, { style: 'short' }).format({
				hours: Math.floor(minutes / 60),
				minutes: Math.round(minutes % 60)
			}),
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
