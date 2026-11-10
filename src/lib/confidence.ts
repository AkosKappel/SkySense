// How sure the forecast is (C-02), from how much the ensemble's runs disagree. Thresholds were
// tuned on the recorded fixtures: docs/decisions/0003.
import type { Hour } from '#lib/weather.js';

export type Confidence = 'high' | 'medium' | 'low';

/**
 * A day's confidence from its hours: the average width of the temperature range (p10 to p90) and
 * how split the runs are on rain (0 when all agree, 1 at fifty-fifty). Null without ensemble data.
 */
export function dayConfidence(hours: Hour[]): Confidence | null {
	const spreads = hours.flatMap((h) => (h.spread ? [h.spread] : []));
	if (spreads.length < hours.length / 2 || !spreads.length) return null;
	const average = (pick: (s: (typeof spreads)[number]) => number) =>
		spreads.reduce((sum, s) => sum + pick(s), 0) / spreads.length;
	const width = average((s) => s.high - s.low);
	const split = average((s) => (Math.min(s.rain, 100 - s.rain) / 100) * 2);
	if (width < 3 && split < 0.6) return 'high';
	if (width < 6 && split < 0.8) return 'medium';
	return 'low';
}
