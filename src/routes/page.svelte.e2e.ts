import { expect, test } from '@playwright/test';

test('home shows the app name', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'SkySense' })).toBeVisible();
});

test('home follows the browser language', async ({ browser }) => {
	const context = await browser.newContext({ locale: 'de-DE' });
	const page = await context.newPage();
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await context.close();
});
