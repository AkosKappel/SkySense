import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/forecast-bratislava.json';
import { toForecast } from '#lib/server/open-meteo.js';
import { formatDistance, metric } from '#lib/units.js';
import { dewComfort, fogAhead } from './details.js';

const at = (hour: number, visibility?: number) => ({
	time: `2026-11-10T${String(hour).padStart(2, '0')}:00`,
	visibility
});

describe('details', () => {
	it('reads visibility, dew point and clouds from the recorded forecast', () => {
		const [now] = toForecast(bratislava).hours;
		expect(now).toMatchObject({ dewPoint: 4.7, clouds: 100 });
		expect(now.visibility).toBeGreaterThan(0);
	});

	it('calls the air muggy from a 16° dew point and oppressive from 20°', () => {
		expect([4, 15.9, 16, 19.9, 20].map(dewComfort)).toEqual([
			null,
			null,
			'muggy',
			'muggy',
			'oppressive'
		]);
	});

	it('finds the first fog and when it clears', () => {
		expect(fogAhead([at(6, 400), at(7, 800), at(8, 3000), at(9, 300)])).toEqual({
			from: '2026-11-10T06:00',
			until: '2026-11-10T08:00'
		});
		expect(fogAhead([at(6, 5000), at(7, 900)], 2)).toEqual({
			from: '2026-11-10T07:00',
			until: '2026-11-10T07:00'
		});
		expect(fogAhead([at(6, 5000), at(7, 900), at(8, 900)], 2)).toEqual({
			from: '2026-11-10T07:00',
			until: '2026-11-10T08:00'
		});
		expect(fogAhead([at(6, 5000), at(7)])).toBeNull();
		expect(fogAhead([at(6, 400)], 0)).toBeNull();
	});

	it('gives visibility in km, or miles where the wind is in mph', () => {
		expect(formatDistance(3200, metric)).toBe('3.2 km');
		expect(formatDistance(24_000, metric, 'de')).toBe('24 km');
		expect(formatDistance(16_093, { ...metric, wind: 'mph' })).toBe('10 mi');
	});
});
