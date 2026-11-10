import { expect, test } from '@playwright/test';

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
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
	expect(errors.filter((e) => e.includes('Content Security Policy'))).toEqual([]);
});

test('API responses send the security headers too', async ({ request }) => {
	const response = await request.get('/api/forecast?lat=48.15&lon=17.11');
	expect(response.ok()).toBe(true);
	expect(response.headers()['x-content-type-options']).toBe('nosniff');
});
