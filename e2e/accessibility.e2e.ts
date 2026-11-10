import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe.js';

// The accessibility pass (P-02): every page through axe, reflow at 320 px (WCAG 1.4.10, the
// same as 1280 px at 400% zoom), a visible focus on everything Tab reaches, and no motion when
// the reader asks for less.
const pages = [
	'/?choose',
	'/p/48.15,17.11/Bratislava',
	'/p/48.15,17.11/Bratislava?day=2026-11-12',
	'/p/48.15,17.11/Bratislava?models',
	'/p/1.29,103.85/Singapore',
	'/settings',
	'/about',
	'/privacy',
	'/p/not-a-place'
];

for (const path of pages) {
	test(`${path} passes axe and reflows at 320 px`, async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.goto(path);
		await expect(page.locator('h1')).toHaveCount(1);
		await expectAccessible(page);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});
}

test('everything Tab reaches on a place page shows where the focus is', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const unseen: string[] = [];
	const reached = new Set<string>();
	for (let i = 0; i < 80; i++) {
		await page.keyboard.press('Tab');
		const focus = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			if (!el || el === document.body) return null;
			const style = getComputedStyle(el);
			const ring = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
			const label = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
			return { label, ring: ring || style.boxShadow !== 'none' };
		});
		if (!focus) continue;
		reached.add(focus.label);
		if (!focus.ring) unseen.push(focus.label);
	}
	expect([...reached].some((label) => label.includes('Compare weather models'))).toBe(true);
	expect(unseen).toEqual([]);
});

test('nothing moves when the reader prefers reduced motion', async ({ browser }) => {
	const context = await browser.newContext({ reducedMotion: 'reduce' });
	const page = await context.newPage();
	await page.goto('/p/48.15,17.11/Bratislava');
	await page.waitForTimeout(500);
	expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
	// The rain particles never start: the canvas keeps its default size.
	await expect(page.locator('canvas')).toHaveJSProperty('width', 300);
	await context.close();
});
