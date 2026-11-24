// The place's climate zone (F-28) from its 1991 to 2020 daily normals, by the Köppen-Geiger rules as
// Peel, Finlayson and McMahon (2007) state them, so the normals the app compares with have a name.
import type { DayNormal } from '#lib/history.js';

export type ClimateKind =
	| 'rainforest'
	| 'monsoon'
	| 'savanna'
	| 'desert'
	| 'steppe'
	| 'mediterranean'
	| 'subtropical'
	| 'oceanic'
	| 'continental'
	| 'subarctic'
	| 'tundra'
	| 'ice';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => sum(values) / values.length;

/** The Köppen code ("Dfb") and its broad kind, or null without a whole year of normals. */
export function koppen(
	normals: DayNormal[],
	southern: boolean
): { code: string; kind: ClimateKind } | null {
	const months = Array.from({ length: 12 }, (_, i) =>
		normals.filter((n) => Number(n.day.slice(0, 2)) === i + 1)
	);
	if (months.some((days) => days.length === 0)) return null;
	const t = months.map((days) => mean(days.map((d) => (d.max + d.min) / 2)));
	const p = months.map((days) => sum(days.map((d) => d.rain)));

	const annualT = mean(t);
	const annualP = sum(p);
	const hottest = Math.max(...t);
	const coldest = Math.min(...t);
	// April to September is summer in the north, October to March in the south.
	const summer = (i: number) => (i >= 3 && i <= 8) !== southern;
	const summerP = p.filter((_, i) => summer(i));
	const winterP = p.filter((_, i) => !summer(i));

	if (hottest < 10)
		return hottest > 0 ? { code: 'ET', kind: 'tundra' } : { code: 'EF', kind: 'ice' };

	const threshold =
		sum(winterP) >= 0.7 * annualP
			? 2 * annualT
			: sum(summerP) >= 0.7 * annualP
				? 2 * annualT + 28
				: 2 * annualT + 14;
	if (annualP < 10 * threshold) {
		const heat = annualT >= 18 ? 'h' : 'k';
		return annualP < 5 * threshold
			? { code: `BW${heat}`, kind: 'desert' }
			: { code: `BS${heat}`, kind: 'steppe' };
	}

	if (coldest >= 18) {
		const driest = Math.min(...p);
		if (driest >= 60) return { code: 'Af', kind: 'rainforest' };
		if (driest >= 100 - annualP / 25) return { code: 'Am', kind: 'monsoon' };
		return { code: 'Aw', kind: 'savanna' };
	}

	const group = coldest > 0 ? 'C' : 'D';
	const dry =
		Math.min(...summerP) < 40 && Math.min(...summerP) < Math.max(...winterP) / 3
			? 's'
			: Math.min(...winterP) < Math.max(...summerP) / 10
				? 'w'
				: 'f';
	const warmMonths = t.filter((v) => v >= 10).length;
	const heat =
		hottest >= 22 ? 'a' : warmMonths >= 4 ? 'b' : group === 'D' && coldest < -38 ? 'd' : 'c';
	const code = `${group}${dry}${heat}`;
	if (group === 'C') {
		if (dry === 's') return { code, kind: 'mediterranean' };
		return { code, kind: heat === 'a' ? 'subtropical' : 'oceanic' };
	}
	return { code, kind: heat === 'a' || heat === 'b' ? 'continental' : 'subarctic' };
}
