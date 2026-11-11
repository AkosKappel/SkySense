import { describe, expect, it } from 'vitest';
import { fold, toIcs } from './calendar.js';

describe('toIcs', () => {
	const ics = toIcs(
		[
			{
				start: '2026-11-12T12:00',
				end: '2026-11-12T13:00',
				title: 'Run, Bratislava',
				description: 'Score 97; dry, calm'
			}
		],
		'Europe/Bratislava',
		'run',
		new Date('2026-11-10T09:00:00Z')
	);

	it('writes one event per window in UTC', () => {
		expect(ics).toContain('DTSTART:20261112T110000Z');
		expect(ics).toContain('DTEND:20261112T120000Z');
		expect(ics).toContain('DTSTAMP:20261110T090000Z');
		expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
	});

	it('escapes text values and uses CRLF', () => {
		expect(ics).toContain('SUMMARY:Run\\, Bratislava');
		expect(ics).toContain('DESCRIPTION:Score 97\\; dry\\, calm');
		expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
	});

	it('folds lines longer than 75 octets without cutting a character', () => {
		const line = `DESCRIPTION:${'ő'.repeat(60)}`;
		const folded = fold(line);
		const lines = folded.split('\r\n');
		expect(lines.length).toBeGreaterThan(1);
		for (const part of lines) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
		expect(lines.slice(1).every((part) => part.startsWith(' '))).toBe(true);
		expect(folded.replace(/\r\n /g, '')).toBe(line);
		expect(fold('SUMMARY:Run')).toBe('SUMMARY:Run');
	});
});
