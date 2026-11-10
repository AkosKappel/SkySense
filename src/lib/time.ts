// Forecast times are the place's local wall-clock time without an offset. Reading them as UTC and
// formatting in UTC shows exactly that wall-clock time, whatever the reader's own time zone is.

/** English dates follow the reader's clock: US style with the 12-hour clock, British otherwise. */
export function intlLocale(locale: string, clock: '24' | '12'): string {
	if (locale !== 'en') return locale;
	return clock === '12' ? 'en-US' : 'en-GB';
}

function asUtc(local: string): Date {
	return new Date(local.length === 10 ? `${local}T00:00:00Z` : `${local}:00Z`);
}

export function formatTime(local: string, locale: string, clock: '24' | '12'): string {
	return new Intl.DateTimeFormat(locale, {
		hour: clock === '12' ? 'numeric' : '2-digit',
		minute: '2-digit',
		hour12: clock === '12',
		timeZone: 'UTC'
	}).format(asUtc(local));
}

/** Just the hour, for compact hourly strips: "14" or "2 PM". */
export function formatHour(local: string, locale: string, clock: '24' | '12'): string {
	return new Intl.DateTimeFormat(locale, {
		hour: clock === '12' ? 'numeric' : '2-digit',
		hour12: clock === '12',
		timeZone: 'UTC'
	}).format(asUtc(local));
}

export function formatWeekday(date: string, locale: string, style: 'short' | 'long' = 'short') {
	return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(asUtc(date));
}

/** "20 July 2025": a past date, where the year matters and the weekday does not. */
export function formatPastDate(date: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(asUtc(date));
}

/** "Jul" or "Jul 2025" for month axes and tables. */
export function formatMonth(month: string, locale: string, withYear = false): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'short',
		...(withYear && { year: 'numeric' }),
		timeZone: 'UTC'
	}).format(asUtc(`${month}-01`));
}

export function formatDate(date: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	}).format(asUtc(date));
}

/**
 * How many hours the place is ahead of the reader (negative: behind). `readerOffsetMinutes` is
 * east of UTC, the opposite sign of `Date.getTimezoneOffset()`.
 */
export function hoursAhead(placeOffsetSeconds: number, readerOffsetMinutes: number): number {
	return (placeOffsetSeconds / 60 - readerOffsetMinutes) / 60;
}
