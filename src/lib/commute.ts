// The commute check (X-19): the reader's two weekday times, and whether rain is likely at each.
// The times live in a cookie, like the units, so the server knows to make room for the line.
import { RAIN_LIKELY, type Hour } from '#lib/weather.js';

export const COMMUTE_COOKIE = 'skysense_commute';

/** Leaving and coming back as "HH:MM", either one optional. */
export type Commute = { leave: string | null; back: string | null };

const time = (value: unknown) =>
	typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;

/** `07:30-17:30`, `07:30-` or `-17:30`; null when neither time is set or the cookie is damaged. */
export function readCommute(cookie: string | undefined): Commute | null {
	const [leave, back] = (cookie ?? '').split('-').map(time);
	return leave || back ? { leave: leave ?? null, back: back ?? null } : null;
}

export function writeCommute(leave: unknown, back: unknown): string {
	return `${time(leave) ?? ''}-${time(back) ?? ''}`;
}

export type Trip = { at: string; wet: boolean };
export type CommuteCheck = { day: 'today' | 'tomorrow'; trips: Trip[] };

const addDay = (date: string) => {
	const next = new Date(`${date}T00:00:00Z`);
	next.setUTCDate(next.getUTCDate() + 1);
	return next.toISOString().slice(0, 10);
};
const weekday = (date: string) => {
	const day = new Date(`${date}T00:00:00Z`).getUTCDay();
	return day >= 1 && day <= 5;
};

/**
 * The trips still ahead today, else tomorrow's, on weekdays only (the place's own calendar). Each
 * trip reads the hour it falls in; rain counts from RAIN_LIKELY. Null at weekends, when the hours
 * do not reach that far, or without a commute.
 */
export function commuteCheck(
	hours: Hour[],
	now: string,
	commute: Commute | null
): CommuteCheck | null {
	if (!commute) return null;
	const times = [commute.leave, commute.back].filter((t) => t !== null);
	const tripsOn = (date: string, after = '') =>
		times
			.map((t) => `${date}T${t}`)
			.filter((at) => at >= after)
			.flatMap((at) => {
				const hour = hours.find((h) => h.time === `${at.slice(0, 13)}:00`);
				return hour ? [{ at, wet: hour.rainChance >= RAIN_LIKELY }] : [];
			});
	const today = now.slice(0, 10);
	if (weekday(today)) {
		const trips = tripsOn(today, now);
		if (trips.length) return { day: 'today', trips };
	}
	const tomorrow = addDay(today);
	if (!weekday(tomorrow)) return null;
	const trips = tripsOn(tomorrow);
	return trips.length ? { day: 'tomorrow', trips } : null;
}
