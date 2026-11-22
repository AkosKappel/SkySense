// A day of ERA5 history (H-09) and the rain day threshold the past tiles share.

export type DailyHistory = {
	date: string;
	max: number;
	min: number;
	rain: number;
	gust: number;
}[];

/** Days with at least 1 mm, the usual meteorological "rain day". */
export const RAIN_DAY_MM = 1;
