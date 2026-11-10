// The past year in weather (X-13): records and monthly totals from a year of daily history.

export type PastDayRecord = { date: string; value: number };
export type MonthSummary = { month: string; meanMax: number; rain: number; rainDays: number };
export type YearInWeather = {
	from: string;
	until: string;
	warmest: PastDayRecord;
	coldest: PastDayRecord;
	wettest: PastDayRecord;
	windiest: PastDayRecord;
	rain: number;
	/** Days with at least 1 mm, the usual meteorological "rain day". */
	rainDays: number;
	months: MonthSummary[];
};

export type DailyHistory = {
	date: string;
	max: number;
	min: number;
	rain: number;
	gust: number;
}[];

export const RAIN_DAY_MM = 1;
const tenth = (n: number) => Math.round(n * 10) / 10;

export function summarizeYear(days: DailyHistory): YearInWeather | null {
	if (!days.length) return null;
	const pick = (value: (d: DailyHistory[number]) => number, higher: boolean): PastDayRecord => {
		const best = days.reduce((a, b) =>
			(higher ? value(b) > value(a) : value(b) < value(a)) ? b : a
		);
		return { date: best.date, value: value(best) };
	};
	const byMonth: Record<string, DailyHistory> = {};
	for (const day of days) (byMonth[day.date.slice(0, 7)] ??= []).push(day);
	const months = Object.entries(byMonth).map(([month, list]) => ({
		month,
		meanMax: tenth(list.reduce((sum, d) => sum + d.max, 0) / list.length),
		rain: tenth(list.reduce((sum, d) => sum + d.rain, 0)),
		rainDays: list.filter((d) => d.rain >= RAIN_DAY_MM).length
	}));
	return {
		from: days[0].date,
		until: days.at(-1)!.date,
		warmest: pick((d) => d.max, true),
		coldest: pick((d) => d.min, false),
		wettest: pick((d) => d.rain, true),
		windiest: pick((d) => d.gust, true),
		rain: tenth(days.reduce((sum, d) => sum + d.rain, 0)),
		rainDays: days.filter((d) => d.rain >= RAIN_DAY_MM).length,
		months
	};
}
