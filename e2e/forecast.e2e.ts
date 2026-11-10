import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe.js';

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
	await expect(
		page.locator('section', { hasText: 'When does it get dark?' }).getByText('16:19')
	).toBeVisible();
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

test('suggests times for the chosen activities and remembers the choice', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const tile = page.locator('section', { hasText: 'When should I go out?' });
	await expect(tile.getByRole('listitem').filter({ hasText: 'Run' })).toContainText(
		'16:00 to 17:00'
	);
	await expect(tile.getByText('Too cold in the next 24 hours.')).toBeVisible();

	await tile.getByRole('listitem').filter({ hasText: 'Run' }).getByText('16:00 to 17:00').click();
	await expect(tile.getByText('Score:', { exact: false }).first()).toBeVisible();
	await expect(tile.getByRole('term').filter({ hasText: 'Feels like' }).first()).toBeVisible();

	await tile.getByText('Choose activities').click();
	await tile.getByRole('checkbox', { name: 'Stargazing' }).check({ force: true });
	await expect(tile.getByRole('listitem').filter({ hasText: 'Stargazing' })).toBeVisible();
	await page.reload();
	await expect(tile.getByRole('listitem').filter({ hasText: 'Stargazing' })).toBeVisible();
	await expectAccessible(page);
});

test('marks the days the model runs disagree on', async ({ page }) => {
	await page.goto('/p/69.65,18.96/Troms%C3%B8');
	const days = page.locator('section', { hasText: '10-day forecast' });
	await expect(days.getByText('Uncertain').first()).toBeVisible();
	await expect(days.getByText(/51 runs of the ECMWF weather model/)).toBeVisible();
	await expect(page.getByText('100% of model runs show it right now.')).toBeVisible();
});

test('compares weather models behind a link', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await page.getByRole('link', { name: 'Compare weather models' }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'Compare weather models' })
	).toBeVisible();
	await expect(page.getByText(/At most \d+° apart in the next 24 hours/)).toBeVisible();
	await expect(page.getByRole('term').filter({ hasText: 'Météo-France' })).toBeVisible();
	await expectAccessible(page);
	await page.getByRole('link', { name: 'Back to the forecast' }).click();
	await expect(page.getByText('Rain until 16:00, then dry.')).toBeVisible();
});

test('compares today with the climate and past years', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const normal = page.locator('section', { hasText: 'Is this normal for the time of year?' });
	await expect(normal.getByText(/than usual\.|About normal/)).toBeVisible();
	await expect(normal.getByText(/\(1991 to 2020\)/)).toBeVisible();
	const past = page.locator('section', { hasText: 'What was this day like in past years?' });
	await expect(past.getByRole('rowheader', { name: '2025' })).toBeVisible();
	await expect(past.getByRole('rowheader', { name: '2016' })).toBeVisible();
	await expectAccessible(page);
});

test('warns about poor air only where it is notable', async ({ page }) => {
	await page.goto('/p/1.29,103.85/Singapore');
	await expect(page.getByText('Poor air quality around 20:00.')).toBeVisible();
	await page.goto('/p/69.65,18.96/Troms%C3%B8');
	await expect(page.getByText('How is the air?')).toHaveCount(0);
});

test('installs and shows a place opened before when offline', async ({ page, context }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
		'href',
		'/manifest.webmanifest'
	);
	await page.evaluate(() => navigator.serviceWorker.ready);
	// The first load happened before the worker took over; this one goes through it and is kept.
	await page.reload();
	await expect(page.getByText('Rain until 16:00, then dry.')).toBeVisible();

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByText('Rain until 16:00, then dry.')).toBeVisible();
	await context.setOffline(false);
});

test('shows recorded scenarios for screenshots with ?demo=', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid?demo=heat');
	await expect(page.getByText(/Hot, up to 35° around 16:00\./)).toBeVisible();
	await page.goto('/p/69.65,18.96/Troms%C3%B8?demo=polar-night');
	await expect(page.getByText("The sun doesn't rise today.")).toBeVisible();
});

test('a place saved in one tab shows up in another', async ({ context }) => {
	const home = await context.newPage();
	await home.goto('/?choose');
	const place = await context.newPage();
	await place.goto('/p/48.15,17.11/Bratislava');
	await place.getByRole('button', { name: 'Save' }).click();
	await expect(home.getByRole('link', { name: /Bratislava/ }).first()).toBeVisible();
});

test('the status bar colour follows the sky', async ({ page }) => {
	await page.goto('/p/69.35,88.2/Norilsk');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111827');
	await page.goto('/settings');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1e1b4b');
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
