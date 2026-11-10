/** After this long in the background, a returning tab loads the forecast again. */
export const STALE_AFTER_MS = 15 * 60 * 1000;

/** "just now" under a minute, otherwise "12 minutes ago" or "2 hours ago" in the language. */
export function age(fetchedAt: string, now: number, locale: string): string | null {
	const minutes = Math.floor((now - Date.parse(fetchedAt)) / 60000);
	if (!Number.isFinite(minutes) || minutes < 1) return null;
	const format = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
	return minutes < 60
		? format.format(-minutes, 'minute')
		: format.format(-Math.floor(minutes / 60), 'hour');
}
