import { describe, expect, it } from 'vitest';
import { auroraTonight, geomagneticLatitude } from './aurora.js';

const slots = (kp: number) => [
	{ start: '2026-11-10T12:00', kp: 8 },
	{ start: '2026-11-10T18:00', kp },
	{ start: '2026-11-11T06:00', kp: 8 }
];
const tromso = { lat: 69.65, lon: 18.96 };
const bratislava = { lat: 48.15, lon: 17.11 };

describe('auroraTonight', () => {
	it('measures latitude from the geomagnetic pole', () => {
		expect(geomagneticLatitude(tromso)).toBeCloseTo(67.5, 0);
		expect(geomagneticLatitude({ lat: -42.9, lon: 147.3 })).toBeLessThan(-45);
	});

	it('takes the strongest Kp between 18:00 and 06:00 at the place', () => {
		expect(auroraTonight(slots(2.33), tromso, '2026-11-10T09:00', 3600)).toEqual({
			kp: 2.3,
			south: false
		});
	});

	it('needs a strong storm this far south, and says nothing without the forecast', () => {
		expect(auroraTonight(slots(5), bratislava, '2026-11-10T09:00', 3600)).toBeNull();
		expect(auroraTonight(slots(7), bratislava, '2026-11-10T09:00', 3600)).toMatchObject({ kp: 7 });
		expect(auroraTonight([], tromso, '2026-11-10T09:00', 3600)).toBeNull();
	});

	it('names the southern lights south of the equator', () => {
		const hobart = { lat: -42.9, lon: 147.3 };
		expect(auroraTonight(slots(7), hobart, '2026-11-10T09:00', 39600)).toMatchObject({
			south: true
		});
	});
});
