import { expect, test } from '@playwright/test';
import { savePlace } from './helpers.js';

test('pages send a content security policy and the other security headers', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});

	const response = await page.goto('/p/48.15,17.11/Bratislava');
	const headers = response?.headers() ?? {};
	const csp = headers['content-security-policy'] ?? '';

	expect(csp).toContain("default-src 'self'");
	expect(csp).toContain("frame-ancestors 'none'");
	expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['permissions-policy']).toContain('geolocation=(self)');

	// The page still hydrates under the policy: a client-side interaction works.
	await savePlace(page);
	expect(errors.filter((e) => e.includes('Content Security Policy'))).toEqual([]);
});

test('API responses send the security headers too', async ({ request }) => {
	const response = await request.get('/api/forecast?lat=48.15&lon=17.11');
	expect(response.ok()).toBe(true);
	expect(response.headers()['x-content-type-options']).toBe('nosniff');
});

test('robots.txt and the sitemap point crawlers at the public pages only', async ({ request }) => {
	const robots = await (await request.get('/robots.txt')).text();
	expect(robots).toContain('Sitemap: http://localhost:4173/sitemap.xml');
	const sitemap = await (await request.get('/sitemap.xml')).text();
	expect(sitemap).toContain('<loc>http://localhost:4173/about</loc>');
	expect(sitemap).not.toContain('/p/');
});

test('pages describe themselves for link previews', async ({ page }) => {
	await page.goto('/about');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		'http://localhost:4173/og.png'
	);
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		'content',
		'The weather, made sense of.'
	);
});
