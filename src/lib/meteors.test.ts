import { describe, expect, it } from 'vitest';
import { meteorPeak } from './meteors.js';

describe('meteorPeak', () => {
	it('names the shower that peaks tonight or tomorrow night', () => {
		expect(meteorPeak('2026-12-13')).toMatchObject({ shower: { id: 'geminids' }, days: 0 });
		expect(meteorPeak('2026-08-11')).toMatchObject({ shower: { id: 'perseids' }, days: 1 });
	});

	it('is quiet on other nights', () => {
		expect(meteorPeak('2026-11-10')).toBeNull();
		expect(meteorPeak('2026-12-15')).toBeNull();
	});
});
