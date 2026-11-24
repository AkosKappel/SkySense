import { describe, expect, it } from 'vitest';
import { koppen } from './koppen.js';
import { toRecord } from './server/open-meteo.js';
import bratislava from './server/fixtures/record-bratislava.json';
import madrid from './server/fixtures/record-madrid.json';
import singapore from './server/fixtures/record-singapore.json';
import tromso from './server/fixtures/record-tromso.json';
import norilsk from './server/fixtures/record-norilsk.json';

const zone = (raw: unknown, southern = false) => koppen(toRecord(raw).normals, southern);

describe('koppen', () => {
	it('names the recorded places’ climates', () => {
		expect(zone(bratislava)).toEqual({ code: 'Cfb', kind: 'oceanic' });
		expect(zone(madrid)).toEqual({ code: 'BSk', kind: 'steppe' });
		expect(zone(singapore)).toEqual({ code: 'Af', kind: 'rainforest' });
		expect(zone(tromso)).toEqual({ code: 'Dfc', kind: 'subarctic' });
		expect(zone(norilsk)).toEqual({ code: 'Dfc', kind: 'subarctic' });
	});

	it('takes summer from the hemisphere', () => {
		// Dry, hot January and February with a wet July: Mediterranean only south of the equator.
		const normals = Array.from({ length: 365 }, (_, i) => {
			const date = new Date(Date.UTC(2021, 0, 1 + i)).toISOString();
			const month = Number(date.slice(5, 7));
			const warm = month <= 3 || month >= 11;
			return {
				day: date.slice(5, 10),
				max: warm ? 30 : 16,
				min: warm ? 18 : 8,
				rain: warm ? 0.1 : 3
			};
		});
		expect(koppen(normals, true)?.kind).toBe('mediterranean');
		expect(koppen(normals, false)?.kind).not.toBe('mediterranean');
	});

	it('needs a whole year of normals', () => {
		expect(koppen([], false)).toBeNull();
	});
});
