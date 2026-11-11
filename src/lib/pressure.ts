// The barometer reading (H-06): sea-level pressure now and how it changed over the last three
// hours, the tendency weather services report. Thresholds and why are in decision 0003.

export type Pressure = {
	/** Sea-level pressure in hPa. */
	hpa: number;
	/** Change over the last three hours in hPa, or null when the hours before are missing. */
	change: number | null;
};

export type PressureTrend = 'risingFast' | 'rising' | 'steady' | 'falling' | 'fallingFast';

/** From this change in three hours a trend counts as rising or falling. */
export const PRESSURE_CHANGES = 1.6;
/** From this change in three hours it is quick. */
export const PRESSURE_CHANGES_FAST = 3.6;

export function pressureTrend(change: number): PressureTrend {
	const size = Math.abs(change);
	if (size < PRESSURE_CHANGES) return 'steady';
	if (change > 0) return size < PRESSURE_CHANGES_FAST ? 'rising' : 'risingFast';
	return size < PRESSURE_CHANGES_FAST ? 'falling' : 'fallingFast';
}

/** The pressure at hour `index` of an hourly series, with its change since three hours before. */
export function pressureAt(values: (number | null)[], index: number): Pressure | null {
	const hpa = values[index];
	if (hpa === null || hpa === undefined) return null;
	const before = index >= 3 ? values[index - 3] : null;
	return {
		hpa,
		change: before === null || before === undefined ? null : Math.round((hpa - before) * 10) / 10
	};
}
