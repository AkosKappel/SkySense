// Open-Meteo is always asked for metric values (one cache entry per place); the reader's units are
// applied when formatting.

export type Units = {
	temperature: 'c' | 'f';
	wind: 'kmh' | 'ms' | 'mph' | 'kn' | 'bft';
	rain: 'mm' | 'in';
	clock: '24' | '12';
};

export const unitChoices = {
	temperature: ['c', 'f'],
	wind: ['kmh', 'ms', 'mph', 'kn', 'bft'],
	rain: ['mm', 'in'],
	clock: ['24', '12']
} as const satisfies { [K in keyof Units]: readonly Units[K][] };

export const metric: Units = { temperature: 'c', wind: 'kmh', rain: 'mm', clock: '24' };
export const imperial: Units = { temperature: 'f', wind: 'mph', rain: 'in', clock: '12' };

export function temperature(celsius: number, units: Units): number {
	return Math.round(units.temperature === 'f' ? (celsius * 9) / 5 + 32 : celsius);
}

/** Upper bounds in km/h of Beaufort 0 to 11; anything faster is 12. */
const beaufortLimits = [2, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];

export function beaufort(kmh: number): number {
	const force = beaufortLimits.findIndex((limit) => kmh < limit);
	return force === -1 ? 12 : force;
}

export function windSpeed(kmh: number, units: Units): number {
	switch (units.wind) {
		case 'ms':
			return Math.round(kmh / 3.6);
		case 'mph':
			return Math.round(kmh / 1.609344);
		case 'kn':
			return Math.round(kmh / 1.852);
		case 'bft':
			return beaufort(kmh);
		default:
			return Math.round(kmh);
	}
}

export const windLabel: Record<Units['wind'], string> = {
	kmh: 'km/h',
	ms: 'm/s',
	mph: 'mph',
	kn: 'kn',
	bft: 'Bft'
};

export function formatWind(kmh: number, units: Units): string {
	const value = windSpeed(kmh, units);
	return units.wind === 'bft' ? `${windLabel.bft} ${value}` : `${value} ${windLabel[units.wind]}`;
}

/** Rain with the decimal separator of `locale` ("1,4 mm" in German). */
export function formatRain(mm: number, units: Units, locale = 'en'): string {
	const inches = units.rain === 'in';
	const digits = inches ? 2 : 1;
	const value = new Intl.NumberFormat(locale, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(inches ? mm / 25.4 : mm);
	return `${value} ${inches ? 'in' : 'mm'}`;
}

/**
 * Pressure in hPa, or inches of mercury for readers who chose inches for rain: there is no
 * separate setting, and the US is where barometers read inHg.
 */
export function formatPressure(hpa: number, units: Units, locale = 'en'): string {
	if (units.rain === 'in') {
		const value = new Intl.NumberFormat(locale, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(hpa * 0.02953);
		return `${value} inHg`;
	}
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: false }).format(hpa)} hPa`;
}
