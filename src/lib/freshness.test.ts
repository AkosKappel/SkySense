import { describe, expect, it } from 'vitest';
import { age } from './freshness.js';

const at = Date.parse('2026-11-10T10:00:00Z');

describe('age', () => {
	it('is null under a minute', () => {
		expect(age('2026-11-10T09:59:30Z', at, 'en')).toBeNull();
		expect(age('2026-11-10T10:00:30Z', at, 'en')).toBeNull();
	});

	it('counts minutes, then hours, in the language', () => {
		expect(age('2026-11-10T09:48:00Z', at, 'en')).toBe('12 minutes ago');
		expect(age('2026-11-10T09:48:00Z', at, 'de')).toBe('vor 12 Minuten');
		expect(age('2026-11-10T07:30:00Z', at, 'hu')).toBe('2 órával ezelőtt');
	});

	it('is null for a bad date', () => {
		expect(age('not a date', at, 'en')).toBeNull();
	});
});
