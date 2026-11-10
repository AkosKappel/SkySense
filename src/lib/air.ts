// Air quality and pollen (H-03), shown only when notable. Levels follow the European Air Quality
// Index bands; pollen bands are rough, shared by every kind: docs/decisions/0003.
import type { Hour, Pollen } from '#lib/weather.js';

export type AirLevel = 'good' | 'fair' | 'moderate' | 'poor' | 'veryPoor' | 'extreme';
export type PollenLevel = 'low' | 'moderate' | 'high';

export function airLevel(aqi: number): AirLevel {
	if (aqi < 20) return 'good';
	if (aqi < 40) return 'fair';
	if (aqi < 60) return 'moderate';
	if (aqi < 80) return 'poor';
	if (aqi < 100) return 'veryPoor';
	return 'extreme';
}

/** Grains per cubic metre. */
export function pollenLevel(grains: number): PollenLevel {
	if (grains < 10) return 'low';
	if (grains < 50) return 'moderate';
	return 'high';
}

export type AirSummary = {
	/** The worst hour, when it is moderate or worse. */
	air: { aqi: number; time: string; level: AirLevel } | null;
	/** The strongest pollen, when it is moderate or high. */
	pollen: { kind: Pollen; level: PollenLevel } | null;
};

/** What is worth saying about the air in `hours`; both null means nothing is. */
export function airSummary(hours: Hour[]): AirSummary {
	const measured = hours.filter((h) => h.aqi !== undefined);
	const worst = measured.reduce<Hour | null>((a, b) => (!a || b.aqi! > a.aqi! ? b : a), null);
	const level = worst ? airLevel(worst.aqi!) : 'good';
	const air =
		worst && level !== 'good' && level !== 'fair'
			? { aqi: Math.round(worst.aqi!), time: worst.time, level }
			: null;

	const strongest = hours.reduce<Hour['pollen'] | null>(
		(a, h) => (h.pollen && (!a || h.pollen.grains > a.grains) ? h.pollen : a),
		null
	);
	const pollen =
		strongest && pollenLevel(strongest.grains) !== 'low'
			? { kind: strongest.kind, level: pollenLevel(strongest.grains) }
			: null;
	return { air, pollen };
}
