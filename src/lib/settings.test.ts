import { describe, expect, it } from 'vitest';
import { localPath } from './settings.js';

describe('localPath', () => {
	it('keeps a path on this site', () => {
		expect(localPath('/p/48.15,17.11/Bratislava?day=2026-11-11')).toBe(
			'/p/48.15,17.11/Bratislava?day=2026-11-11'
		);
	});

	it('never sends the reader to another site', () => {
		for (const value of [null, '', 'https://example.com', '//example.com', '/\\example.com']) {
			expect(localPath(value)).toBe('/');
		}
	});
});
