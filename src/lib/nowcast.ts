// Rain in the next two hours from 15-minute data (M-02), only where a model runs natively at that
// step (ICON-D2 over central Europe, AROME over France and around, HRRR over the United States).
// Elsewhere Open-Meteo would interpolate hourly data, which would sound more precise than it is.
import { RAIN_LIKELY, type Hour } from '#lib/weather.js';

export type NowcastStep = { time: string; rain: number };

/** From this much in a quarter hour (mm), a step counts as wet. */
export const NOWCAST_WET_MM = 0.1;

/**
 * When the rain starts or stops within the steps from `now`, or null when nothing changes: dry
 * throughout says nothing the hourly answer does not, and neither does rain throughout. The
 * 15-minute models are not the hourly forecast's, so where they disagree about now (`wetHour`,
 * the hourly answer) the line is left out rather than contradict the answer above it.
 */
export function rainTurn(
	steps: NowcastStep[],
	now: string,
	wetHour: boolean
): { turn: 'starts' | 'stops'; at: string } | null {
	const ahead = steps.filter((s) => s.time >= `${now.slice(0, 14)}${quarter(now)}`);
	if (ahead.length < 2) return null;
	const wetNow = ahead[0].rain >= NOWCAST_WET_MM;
	if (wetNow !== wetHour) return null;
	const change = ahead.find((s) => s.rain >= NOWCAST_WET_MM !== wetNow);
	return change ? { turn: wetNow ? 'stops' : 'starts', at: change.time } : null;
}

/** The quarter hour `now` falls in, as "00", "15", "30" or "45". */
const quarter = (now: string) =>
	String(Math.floor(Number(now.slice(14, 16)) / 15) * 15).padStart(2, '0');

export type RainAhead = { turn: 'starts' | 'stops'; at: string; quarter: boolean };

/**
 * Whether the rain is about to start or stop (F-32), for a screen that cannot wait to be asked:
 * the quarter hours where a model has them, else the next hour against this one. Where quarter
 * hours exist and see no change, the hourly guess is not asked: they know the next two hours better.
 * Hours before the current one are expected to be gone (`upcoming`).
 */
export function rainAhead(
	steps: NowcastStep[] | undefined,
	hours: Hour[],
	now: string
): RainAhead | null {
	const wetHour = (hours[0]?.rainChance ?? 0) >= RAIN_LIKELY;
	// Quarter hours left over from an earlier fetch (a wall offline for a while) no longer count.
	if (steps?.some((s) => s.time > now)) {
		const found = rainTurn(steps, now, wetHour);
		return found && { ...found, quarter: true };
	}
	const next = hours[1];
	if (!next || next.rainChance >= RAIN_LIKELY === wetHour) return null;
	return { turn: wetHour ? 'stops' : 'starts', at: next.time, quarter: false };
}
