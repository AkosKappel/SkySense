import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectAccessible(page: Page) {
	const results = await new AxeBuilder({ page }).analyze();
	expect(
		results.violations.map(
			(v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
		)
	).toEqual([]);
}

test('finds a place and shows its forecast', async ({ page }) => {
	await page.goto('/');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Where should we look?' })
	).toBeVisible();
	await expectAccessible(page);

	await page.getByRole('combobox', { name: 'Search for a place' }).fill('Bratisl');
	const first = page.getByRole('option').first();
	await expect(first).toContainText('Bratislava');
	await expect(first).toContainText('Slovensko');
	await page.keyboard.press('Enter');

	await expect(page).toHaveURL(/\/p\/48\.15,17\.11\/Bratislava$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'Weather in Bratislava' })
	).toBeAttached();
	await expect(page.getByText('6°', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('Rain until 16:00, then dry.')).toBeVisible();
	await expect(page.getByText('Do I need an umbrella?')).toBeVisible();
	await expect(page.getByText('When does it get dark?')).toBeVisible();
	await expect(page.getByText('Updated just now')).toBeVisible();
	await expect(page.getByText(/From the east · 12 km\/h/)).toBeVisible();
	await expect(page.getByText(/^16:\d\d$/).first()).toBeVisible();
	await expectAccessible(page);
});

test('reopens the last place and keeps saved places', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid');
	await expect(page.getByRole('heading', { level: 1, name: 'Weather in Madrid' })).toBeAttached();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);

	await page.goto('/');
	await expect(page).toHaveURL(/\/p\/40\.42,-3\.7\/Madrid$/);

	await page.goto('/?choose');
	await expect(page.getByRole('link', { name: 'Madrid' })).toBeVisible();
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('button', { name: 'Remove Madrid' }).click();
	await expect(page.getByRole('textbox', { name: 'Rename Madrid' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Undo' }).click();

	await page.getByRole('textbox', { name: 'Rename Madrid' }).fill('Home');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('textbox', { name: 'Rename Home' })).toBeAttached();
	await page.getByRole('button', { name: 'Done' }).click();
	await page.getByRole('link', { name: 'Home' }).click();
	await expect(page).toHaveURL(/\/p\/40\.42,-3\.7\/Home$/);
	await page.goto('/?choose');
	await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
});

test('switches places in a sheet that Back and Escape close', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Weather in Bratislava' })
	).toBeAttached();

	const change = page.getByRole('link', { name: /Change place/ });
	const sheet = page.getByRole('dialog', { name: 'Change place' });
	await change.click();
	await expect(sheet).toBeVisible();
	await expectAccessible(page);
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(change).toBeFocused();

	await change.click();
	await expect(sheet).toBeVisible();
	await page.goBack();
	await expect(sheet).toBeHidden();
	await expect(page).toHaveURL(/Bratislava$/);

	await page.keyboard.press('/');
	await expect(sheet.getByRole('combobox', { name: 'Search for a place' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	await change.click();
	await sheet.getByRole('link', { name: /Madrid/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Weather in Madrid' })).toBeAttached();
	await expect(sheet).toBeHidden();
	await page.goBack();
	await expect(page).toHaveURL(/Bratislava$/);
	await expect(sheet).toBeHidden();
});

test('settings change units and language', async ({ page }) => {
	await page.goto('/settings');
	await expectAccessible(page);
	await page.getByText('Fahrenheit (°F)').click();
	await page.getByLabel('Language').selectOption('de');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status')).toHaveText('Einstellungen gespeichert.');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');

	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Wetter in Bratislava' })
	).toBeAttached();
	await expect(page.getByText('43°', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('Brauche ich einen Schirm?')).toBeVisible();
});

test('follows the browser language on a first visit', async ({ browser }) => {
	const context = await browser.newContext({ locale: 'hu-HU' });
	const page = await context.newPage();
	await page.goto('/p/69.65,18.96/Troms%C3%B8');
	await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
	await expect(page.getByRole('heading', { level: 1, name: 'Időjárás: Tromsø' })).toBeAttached();
	await context.close();
});

test('an unknown place shows a helpful page', async ({ page }) => {
	const response = await page.goto('/p/not-a-place');
	expect(response?.status()).toBe(404);
	await expect(
		page.getByRole('heading', { level: 1, name: "We can't find that place." })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Search for a place' })).toBeVisible();
});

test('opens a day from the 10-day list and goes back', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await page.getByRole('link', { name: /^Thu/ }).first().click();

	await expect(page).toHaveURL(/\?day=2026-11-12$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Thursday 12 November' })).toBeVisible();
	await expect(page.getByText('Hour by hour')).toBeVisible();
	await expect(page.getByText('Do I need an umbrella?')).toBeVisible();
	await expect(page.getByText('Now', { exact: true })).toHaveCount(0);

	await page.getByRole('link', { name: 'Back to the forecast' }).click();
	await expect(page.getByText('10-day forecast')).toBeVisible();
});
