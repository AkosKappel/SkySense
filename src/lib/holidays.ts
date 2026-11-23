// Public holidays in the place's country (F-26): one line above the summary when today or
// tomorrow is one. Names come from Nager.Date in English and in the country's own language.

export type Holiday = { date: string; localName: string; name: string };

/** A place's holidays in the forecast's days, and which of the app's languages its country speaks. */
export type PlaceHolidays = { languages: string[]; days: Holiday[] };

/** Where each of the app's languages is spoken, so a reader sees the holiday in their own words. */
const countriesOf: Record<string, string[]> = {
	de: ['de', 'at', 'ch', 'li', 'lu'],
	sk: ['sk'],
	hu: ['hu'],
	es: [
		'es',
		'mx',
		'ar',
		'co',
		'cl',
		'pe',
		've',
		'ec',
		'gt',
		'cu',
		'bo',
		'do',
		'hn',
		'py',
		'sv',
		'ni',
		'cr',
		'pa',
		'uy'
	]
};

/** The app's languages spoken in a country, so the server can say which readers get local names. */
export function languagesOf(country: string): string[] {
	return Object.keys(countriesOf).filter((locale) => countriesOf[locale].includes(country));
}

/**
 * The holiday's own name where the reader's language is spoken there ("Štedrý deň" for a Slovak
 * reader in Slovakia), otherwise the English one, which a German reader in Madrid is likelier to
 * follow than the Spanish. Nager.Date has no other translations.
 */
export function holidayName(holiday: Holiday, languages: string[], locale: string): string {
	return languages.includes(locale) ? holiday.localName : holiday.name;
}

/** Holidays from `from` for `days` days, in date order; two on one day keep both. */
export function holidaysWithin(holidays: Holiday[], from: string, days: number): Holiday[] {
	const end = new Date(`${from}T00:00:00Z`);
	end.setUTCDate(end.getUTCDate() + days);
	const until = end.toISOString().slice(0, 10);
	return holidays
		.filter((h) => h.date >= from && h.date < until)
		.sort((a, b) => a.date.localeCompare(b.date));
}

export type HolidayLine = { when: 'today' | 'tomorrow'; name: string };

/**
 * Today's holiday, else tomorrow's, named for the reader, else nothing: further ahead it would be
 * a calendar. `today` is the place's date.
 */
export function holidayLine(
	holidays: PlaceHolidays | undefined,
	today: string,
	locale: string
): HolidayLine | null {
	if (!holidays) return null;
	const next = new Date(`${today}T00:00:00Z`);
	next.setUTCDate(next.getUTCDate() + 1);
	const tomorrow = next.toISOString().slice(0, 10);
	const found =
		holidays.days.find((h) => h.date === today) ?? holidays.days.find((h) => h.date === tomorrow);
	if (!found) return null;
	return {
		when: found.date === today ? 'today' : 'tomorrow',
		name: holidayName(found, holidays.languages, locale)
	};
}
