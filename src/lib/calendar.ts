// Activity windows as an iCalendar file (X-11), made in the browser and downloaded, no server.
// Times are the place's wall clock; with its UTC offset they become UTC, so a calendar anywhere
// shows them right. ponytail: one offset for all ten days, off by an hour across a DST change.

export type CalendarEvent = { start: string; end: string; title: string; description: string };

/** "2026-11-12T12:00" at UTC+1 becomes "20261112T110000Z". */
function utcStamp(local: string, utcOffsetSeconds: number): string {
	const ms = Date.parse(`${local}:00Z`) - utcOffsetSeconds * 1000;
	return new Date(ms)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

/** Commas, semicolons and backslashes are special in text values; newlines become \n. */
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function toIcs(
	events: CalendarEvent[],
	utcOffsetSeconds: number,
	uidSuffix: string,
	now = new Date()
): string {
	const stamp = now
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//SkySense//Activity windows//EN',
		'CALSCALE:GREGORIAN',
		...events.flatMap((event) => [
			'BEGIN:VEVENT',
			`UID:${event.start}-${uidSuffix}@skysense`,
			`DTSTAMP:${stamp}`,
			`DTSTART:${utcStamp(event.start, utcOffsetSeconds)}`,
			`DTEND:${utcStamp(event.end, utcOffsetSeconds)}`,
			`SUMMARY:${escape(event.title)}`,
			`DESCRIPTION:${escape(event.description)}`,
			'END:VEVENT'
		]),
		'END:VCALENDAR'
	];
	// The format wants CRLF line endings.
	return lines.join('\r\n') + '\r\n';
}
