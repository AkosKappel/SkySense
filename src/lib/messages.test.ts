import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import settings from '../../project.inlang/settings.json';

// A message is a string, or plural variants: [{ declarations, selectors, match: { 'n=one': '…' } }].
type Message = string | { match: Record<string, string> }[];
type Messages = Record<string, Message>;

/** Every text a message can show, one per variant. */
const texts = (message: Message): string[] =>
	typeof message === 'string' ? [message] : message.flatMap((v) => Object.values(v.match));

const load = (locale: string): Messages => {
	const messages = JSON.parse(
		readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), 'utf-8')
	);
	delete messages.$schema;
	return messages;
};

/** Placeholders used in any variant; a variant may leave one out ("about an hour"). */
const placeholders = (message: Message) =>
	[
		...new Set(texts(message).flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))
	].sort();

const base = load(settings.baseLocale);
const others = settings.locales.filter((locale) => locale !== settings.baseLocale);

describe.each(others)('%s messages', (locale) => {
	const messages = load(locale);

	it('have exactly the English keys', () => {
		expect(Object.keys(messages).sort()).toEqual(Object.keys(base).sort());
	});

	it('use the same placeholders as English', () => {
		for (const [key, message] of Object.entries(base)) {
			expect(placeholders(messages[key] ?? ''), key).toEqual(placeholders(message));
		}
	});

	it('give every plural form of the language its own variant', () => {
		// The forms whole numbers of hours or days can take ('many' is for fractions and millions).
		const rules = new Intl.PluralRules(locale);
		const forms = [...new Set(Array.from({ length: 101 }, (_, n) => rules.select(n)))];
		const problems: Record<string, string[]> = {};
		for (const [key, message] of Object.entries(messages)) {
			if (typeof message === 'string') continue;
			const covered = message.flatMap((v) => Object.keys(v.match).map((k) => k.split('=')[1]));
			const missing: string[] = forms.filter((form) => form !== 'other' && !covered.includes(form));
			if (!covered.includes('*')) missing.push('*');
			if (missing.length) problems[key] = missing;
		}
		expect(problems).toEqual({});
	});

	it('are never empty', () => {
		for (const [key, message] of Object.entries(messages)) {
			for (const text of texts(message)) expect(text.trim(), key).not.toBe('');
		}
	});
});

describe('plural sentences', () => {
	it('pick the form for the count', async () => {
		const { m } = await import('#lib/paraglide/messages.js');
		const later = (hours: number, locale: 'en' | 'sk' | 'de') =>
			m.summary_rain_later({ from: '14:00', hours }, { locale });
		expect(later(1, 'en')).toBe('Dry until 14:00, then about an hour of rain.');
		expect(later(3, 'en')).toBe('Dry until 14:00, then about 3 hours of rain.');
		expect(later(1, 'sk')).toBe('Do 14:00 sucho, potom bude asi hodinu pršať.');
		expect(later(3, 'sk')).toBe('Do 14:00 sucho, potom bude asi 3 hodiny pršať.');
		expect(later(5, 'sk')).toBe('Do 14:00 sucho, potom bude asi 5 hodín pršať.');
		expect(later(2, 'de')).toBe('Trocken bis 14:00, dann etwa 2 Stunden Regen.');
	});
});
