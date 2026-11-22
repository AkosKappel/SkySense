// How the weather at a place has changed since 1961 (H-10), from ERA5's daily record reduced to
// years and months on the server.
import { addDays, type DayNormal } from '#lib/history.js';
import { RAIN_DAY_MM } from '#lib/year.js';

export const RECORD_FROM = 1961;
/** The WMO's reference period for climate change, against which every year is coloured. */
export const REFERENCE = [1961, 1990] as const;
export const HOT_DAY = 30;
const RECENT_YEARS = 10;

export type YearStats = {
	year: number;
	/** Mean of (high + low) / 2 over the year, °C. */
	mean: number;
	/** Days of 30 °C or more. */
	hot: number;
	/** Nights below 0 °C. */
	frost: number;
	rain: number;
	rainDays: number;
};
/** One month of one year: "1961-11" and its mean temperature. */
export type MonthMean = { month: string; mean: number };
/** Everything the history view needs from the long record, one request per ERA5 cell. */
export type ClimateRecord = { normals: DayNormal[]; years: YearStats[]; months: MonthMean[] };

type Day = { date: string; max: number; min: number; rain: number };

const tenth = (n: number) => Math.round(n * 10) / 10;
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** ERA5's grid is 0.25°, so places within a cell share one request and one cached answer. */
export const era5Cell = ({ lat, lon }: { lat: number; lon: number }) => ({
	lat: Math.round(lat * 4) / 4,
	lon: Math.round(lon * 4) / 4
});

/** The years and months of whole days; a year with gaps counts its days as they are. */
export function summarizeRecord(days: Day[]): Pick<ClimateRecord, 'years' | 'months'> {
	const byYear = Map.groupBy(days, (d) => d.date.slice(0, 4));
	const byMonth = Map.groupBy(days, (d) => d.date.slice(0, 7));
	const daily = (d: Day) => (d.max + d.min) / 2;
	return {
		years: [...byYear].map(([year, list]) => ({
			year: Number(year),
			mean: tenth(mean(list.map(daily))),
			hot: list.filter((d) => d.max >= HOT_DAY).length,
			frost: list.filter((d) => d.min < 0).length,
			rain: Math.round(list.reduce((sum, d) => sum + d.rain, 0)),
			rainDays: list.filter((d) => d.rain >= RAIN_DAY_MM).length
		})),
		months: [...byMonth].map(([month, list]) => ({ month, mean: tenth(mean(list.map(daily))) }))
	};
}

/** Least squares slope of y over x. */
function slope(points: { x: number; y: number }[]): number {
	const mx = mean(points.map((p) => p.x));
	const my = mean(points.map((p) => p.y));
	const num = points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0);
	const den = points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0);
	return den ? num / den : 0;
}

/** `to` is the decade's last year in the record: 2025 for the 2020s while they last. */
export type Decade = { decade: number; to: number; hot: number; frost: number; rainDays: number };
export type Trend = {
	/** Each year's mean against the reference, for the stripes. */
	stripes: { year: number; anomaly: number }[];
	/** The last ten years' mean against the reference, °C. */
	warming: number;
	firstYear: number;
	lastYear: number;
	/** Per year on average, in each decade with at least five years. */
	decades: Decade[];
	/** The chosen month across the years: its change per decade, °C. */
	monthPerDecade: number | null;
};

/** Null when the record is too short to say anything about change. */
export function trendOf(record: ClimateRecord, month: number): Trend | null {
	const { years } = record;
	const reference = years.filter((y) => y.year >= REFERENCE[0] && y.year <= REFERENCE[1]);
	if (reference.length < 20 || years.length < reference.length + RECENT_YEARS) return null;
	const base = mean(reference.map((y) => y.mean));

	const decades = [...Map.groupBy(years, (y) => Math.floor(y.year / 10) * 10)]
		.filter(([, list]) => list.length >= 5)
		.map(([decade, list]) => ({
			decade,
			to: list.at(-1)!.year,
			hot: tenth(mean(list.map((y) => y.hot))),
			frost: tenth(mean(list.map((y) => y.frost))),
			rainDays: Math.round(mean(list.map((y) => y.rainDays)))
		}));

	const monthKey = String(month).padStart(2, '0');
	const series = record.months
		.filter((m) => m.month.slice(5) === monthKey)
		.map((m) => ({ x: Number(m.month.slice(0, 4)), y: m.mean }));

	return {
		stripes: years.map((y) => ({ year: y.year, anomaly: tenth(y.mean - base) })),
		warming: tenth(mean(years.slice(-RECENT_YEARS).map((y) => y.mean)) - base),
		firstYear: years[0].year,
		lastYear: years.at(-1)!.year,
		decades,
		monthPerDecade: series.length >= 30 ? tenth(slope(series) * 10) : null
	};
}

/** The last whole year ERA5 has for a place whose date is `today`, as `/api/record` expects it. */
export const lastWholeYear = (today: string) => Number(addDays(today, -10).slice(0, 4)) - 1;
