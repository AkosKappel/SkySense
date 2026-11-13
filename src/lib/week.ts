import {
	activities,
	bestDay,
	dailyWindows,
	type ActivityId,
	type ActivityWindow
} from '#lib/activities.js';
import type { Day, Hour } from '#lib/weather.js';

// The week page (F-24): each day as a row of its 24 hours, and the best time per chosen activity.

export type WeekRow = {
	day: Day;
	/** Midnight to 23:00; null for the hours of today already gone, so the rows line up. */
	hours: (Hour | null)[];
	/** The day's best window for each chosen activity that has one. */
	windows: { id: ActivityId; window: ActivityWindow }[];
};

export function weekRows(days: Day[], hours: Hour[], chosen: ActivityId[], shift = 0): WeekRow[] {
	const windows = chosen.map((id) => ({
		id,
		list: dailyWindows(activities[id], hours, days, shift)
	}));
	return days.map((day) => {
		const byHour = new Map(
			hours.filter((h) => h.time.startsWith(day.date)).map((h) => [Number(h.time.slice(11, 13)), h])
		);
		return {
			day,
			hours: Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? null),
			windows: windows.flatMap(({ id, list }) => {
				const window = list.find((w) => w.from.startsWith(day.date));
				return window ? [{ id, window }] : [];
			})
		};
	});
}

/** "Which day is best?": the best window of the week for each chosen activity, or null. */
export function bestDays(days: Day[], hours: Hour[], chosen: ActivityId[], shift = 0) {
	return chosen.map((id) => ({ id, window: bestDay(activities[id], hours, days, shift) }));
}

/** A temperature's height in a bar, from the week's lowest (a sliver) to its highest (full). */
export function barHeight(temp: number, low: number, high: number): number {
	return 0.15 + (0.85 * (temp - low)) / Math.max(1, high - low);
}
