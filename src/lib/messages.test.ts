import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import settings from '../../project.inlang/settings.json';

type Messages = Record<string, string>;

const load = (locale: string): Messages => {
	const messages = JSON.parse(
		readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), 'utf-8')
	);
	delete messages.$schema;
	return messages;
};

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const base = load(settings.baseLocale);
const others = settings.locales.filter((locale) => locale !== settings.baseLocale);

describe.each(others)('%s messages', (locale) => {
	const messages = load(locale);

	it('have exactly the English keys', () => {
		expect(Object.keys(messages).sort()).toEqual(Object.keys(base).sort());
	});

	it('use the same placeholders as English', () => {
		for (const [key, text] of Object.entries(base)) {
			expect(placeholders(messages[key] ?? ''), key).toEqual(placeholders(text));
		}
	});

	it('are never empty', () => {
		for (const [key, text] of Object.entries(messages)) expect(text.trim(), key).not.toBe('');
	});
});
