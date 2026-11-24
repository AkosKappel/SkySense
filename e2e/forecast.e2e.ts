import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe.js';
import { blankMapTiles, placeReady, savePlace } from './helpers.js';

test('the home page shows live answers for three places, switched by the reader', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByText('Right now in Bratislava')).toBeVisible();
	await page.getByText('Madrid', { exact: true }).click();
	await expect(page.getByText('Right now in Madrid')).toBeVisible();
	await page.getByRole('link', { name: 'See the full forecast for Madrid' }).click();
	await expect(page).toHaveURL(/\/p\/40\.42,-3\.7\/Madrid$/);
});

test('finds a place and shows its forecast', async ({ page }) => {
	await page.goto('/');
	await expect(
		page.getByRole('heading', { level: 1, name: 'The weather, made sense of.' })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Where should we look?' })
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
	// The darkness tile loads when scrolled near, like the climate tiles placeReady waits for.
	await placeReady(page);
	await expect(page.getByText('When does it get dark?')).toBeVisible();
	// The server keeps forecasts for a few minutes, so later in a run this place can be a minute old.
	await expect(page.getByText(/^Updated (just now|\d+ minutes? ago)$/)).toBeVisible();
	await expect(page.getByText(/From the east · 12 km\/h/)).toBeVisible();
	await expect(
		page.locator('section', { hasText: 'When does it get dark?' }).getByText('16:19')
	).toBeVisible();
	await expect(page.getByText(/of daylight today, 3 minutes less tomorrow\.$/)).toBeVisible();
	// Computed on the server for the recorded morning (H-07); the US Naval Observatory agrees.
	await expect(
		page.getByText(
			'Moonset at 16:23. Moonrise tomorrow at 09:28. Next full moon: Tuesday 24 November.'
		)
	).toBeVisible();
	await expectAccessible(page);
});

test('reopens the last place and keeps saved places', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid');
	await expect(page.getByRole('heading', { level: 1, name: 'Weather in Madrid' })).toBeAttached();
	await savePlace(page);
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

test('saves places to a file and loads them back', async ({ page }) => {
	await page.goto('/?choose');
	await page.getByText('Load from a file').setInputFiles({
		name: 'skysense-places.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify([{ name: 'Madrid', lat: 40.42, lon: -3.7 }]))
	});
	await expect(page.getByText('Added one place.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Madrid' })).toBeVisible();

	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Save to a file' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('skysense-places.json');
	const text = Buffer.concat(await (await file.createReadStream()).toArray()).toString();
	expect(JSON.parse(text)).toEqual([{ name: 'Madrid', lat: 40.42, lon: -3.7 }]);
});

test('lists the keyboard shortcuts on ?', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	await page.keyboard.press('?');
	const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('Find a place')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await page.keyboard.press('?');
	await expect(dialog).toBeVisible();
});

test('switches places in a sheet that Back and Escape close', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid');
	await savePlace(page);
	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Weather in Bratislava' })
	).toBeAttached();
	await placeReady(page);

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

	await page.keyboard.press('Control+k');
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

test('picks a place on a map, by pointer or keyboard, only once confirmed', async ({ page }) => {
	await blankMapTiles(page);
	await page.goto('/p/69.65,18.96/Troms%C3%B8');
	await placeReady(page);
	await page.getByRole('link', { name: /Change place/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Change place' });
	await sheet.getByRole('button', { name: 'Pick on the map' }).click();

	// The map opens on the current place, named from the reverse geocoder, and takes focus.
	const map = sheet.getByRole('application', { name: 'Pick on the map' });
	await expect(map).toBeFocused();
	await expect(sheet.getByText('Tromsø · 69.65,18.96')).toBeVisible();
	await expectAccessible(page);

	// Panning with the keys moves the spot; Escape closes the map, not the sheet.
	await page.keyboard.press('ArrowRight');
	await expect(sheet.getByText('Tromsø · 69.65,18.96')).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(map).toBeHidden();
	await expect(sheet).toBeVisible();
	await expect(page).toHaveURL(/Troms%C3%B8$/);

	await sheet.getByRole('button', { name: 'Pick on the map' }).click();
	await expect(sheet.getByText('Tromsø · 69.65,18.96')).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose this spot' }).click();
	await expect(page).toHaveURL(/\/p\/69\.65,18\.96\/Troms%C3%B8$/);
	await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('suggests times for the chosen activities and remembers the choice', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	const tile = page.locator('section', { hasText: 'When should I go out?' });
	await expect(tile.getByRole('listitem').filter({ hasText: 'Run' })).toContainText(
		'16:00 to 17:00'
	);
	await expect(tile.getByText('Too cold in the next 24 hours.')).toBeVisible();

	await tile.getByRole('listitem').filter({ hasText: 'Run' }).getByText('16:00 to 17:00').click();
	await expect(tile.getByText('Score:', { exact: false }).first()).toBeVisible();
	await expect(tile.getByRole('term').filter({ hasText: 'Feels like' }).first()).toBeVisible();

	await tile.getByText('Choose activities').click();
	// The chip people tap; the checkbox inside it is visually hidden.
	await tile.locator('label', { hasText: 'Stargazing' }).click();
	await expect(tile.getByRole('checkbox', { name: 'Stargazing' })).toBeChecked();
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
	await placeReady(page);
	const normal = page.locator('section', { hasText: 'Is this normal for the time of year?' });
	await expect(normal.getByText(/^\d+° (warmer|colder) than usual\.$|About normal/)).toBeVisible();
	await expect(normal.getByText(/\(1991 to 2020\)/)).toBeVisible();
	await expect(normal.getByText('The last 7 days were 2° colder than usual.')).toBeVisible();
	await expect(normal.getByText(/for the time of year\.$/)).toHaveCount(0);
	const past = page.locator('section', { hasText: 'What was this day like in past years?' });
	await expect(past.getByRole('rowheader', { name: '2025' })).toBeVisible();
	await expect(past.getByRole('rowheader', { name: '2016' })).toBeVisible();
	await expectAccessible(page);
});

test('says when today is unusual for the time of year', async ({ page }) => {
	await page.goto('/p/69.35,88.2/Norilsk');
	await placeReady(page);
	const normal = page.locator('section', { hasText: 'Is this normal for the time of year?' });
	await expect(normal.getByText('Unusual for the time of year.')).toBeVisible();
	await expect(
		normal.getByText('A milder night than 91% of nights around this date in 1991 to 2020.')
	).toBeVisible();
	await expect(normal.getByText(/^The last 7 days were \d° warmer than usual\.$/)).toBeVisible();
});

test('says how long it has been dry', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	const dry = page.locator('section', { hasText: 'How dry has it been?' });
	await expect(dry.getByText('Dry for 9 days.')).toBeVisible();
	await expect(dry.getByText(/^Last rain: .+ on Saturday 31 October\.$/)).toBeVisible();
	await expect(dry.getByText(/^So far this month: /)).toBeVisible();
});

test("reads the barometer in today's details", async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const details = page.locator('section', { hasText: 'Today in detail' });
	await expect(details.getByRole('definition').filter({ hasText: 'hPa' })).toHaveText(
		'1014 hPa · steady'
	);
	await page.goto('/p/69.65,18.96/Tromso?demo=polar-night');
	await expect(page.getByText('985 hPa · falling')).toBeVisible();
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
	await expect(page.getByRole('status').filter({ hasText: "You're offline." })).toBeVisible();
	await context.setOffline(false);
});

test('shows recorded scenarios for screenshots with ?demo=', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid?demo=heat');
	await expect(page.getByText(/Hot, up to 35° around 16:00\./)).toBeVisible();
	await page.goto('/p/69.65,18.96/Troms%C3%B8?demo=polar-night');
	await placeReady(page);
	await expect(page.getByText("The sun doesn't rise today.")).toBeVisible();
});

test('a place saved in one tab shows up in another', async ({ context }) => {
	const home = await context.newPage();
	await home.goto('/?choose');
	const place = await context.newPage();
	await place.goto('/p/48.15,17.11/Bratislava');
	await savePlace(place);
	await expect(home.getByRole('link', { name: /Bratislava/ }).first()).toBeVisible();
});

test('the status bar colour follows the sky in each theme', async ({ context, page }) => {
	const meta = page.locator('meta[name="theme-color"]');
	const theme = (value: string) =>
		context.addCookies([{ name: 'skysense_theme', value, url: 'http://localhost:4173' }]);
	await theme('dark');
	await page.goto('/p/69.35,88.2/Norilsk');
	await expect(meta).toHaveAttribute('content', '#111827');
	await page.goto('/settings');
	await expect(meta).toHaveAttribute('content', '#1e1b4b');
	await theme('light');
	await page.goto('/p/69.35,88.2/Norilsk');
	await expect(meta).toHaveAttribute('content', '#94a3b8');
	// Following the system, there is one colour per scheme until a place sets its own.
	await theme('system');
	await page.goto('/settings');
	await expect(meta).toHaveCount(2);
});

test('the weather theme is light under a clear day and dark under rain', async ({
	context,
	page
}) => {
	await context.addCookies([
		{ name: 'skysense_theme', value: 'weather', url: 'http://localhost:4173' }
	]);
	const scheme = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
	await page.goto('/p/48.15,17.11/Bratislava');
	expect(await scheme()).toBe('dark');
	await page.goto('/p/40.42,-3.7/Madrid?demo=heat');
	expect(await scheme()).toBe('light');
	// Without a sky, it follows the system like "Like the system".
	await page.goto('/settings');
	expect(await scheme()).toBe('light dark');
});

test('switches the language from the footer and comes back to the page', async ({ page }) => {
	await page.goto('/about');
	await page
		.getByRole('navigation', { name: 'Language' })
		.getByRole('link', { name: 'Deutsch' })
		.click();
	await expect(page).toHaveURL(/\/about$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await expect(
		page.getByRole('navigation', { name: 'Sprache' }).getByText('Deutsch')
	).toHaveAttribute('aria-current', 'true');
});

test('downloads the good times for an activity as a calendar file', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	const tile = page.locator('section', { hasText: 'When should I go out?' });
	await tile.getByRole('listitem').filter({ hasText: 'Run' }).getByText('16:00 to 17:00').click();
	const download = page.waitForEvent('download');
	await tile.getByRole('button', { name: 'Add the good times to your calendar' }).first().click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('skysense-run.ics');
	const text = await (await file.createReadStream()).toArray();
	const ics = Buffer.concat(text).toString();
	expect(ics).toContain('SUMMARY:Run in Bratislava');
	// 16:00 in Bratislava (UTC+1) is 15:00 UTC.
	expect(ics).toContain('DTSTART:20261110T150000Z');
});

test('"My location" locates again when opened and names the town', async ({ context, page }) => {
	await context.grantPermissions(['geolocation']);
	await context.setGeolocation({ latitude: 48.15, longitude: 17.11 });
	await page.goto('/?choose');
	// A click before the page has hydrated does nothing (the button needs JavaScript), so it is
	// retried until the page moves on.
	await expect(async () => {
		await page.getByRole('button', { name: 'Use my location' }).click({ timeout: 2000 });
		await expect(page).toHaveURL(/\/p\/48\.15,17\.11\/Bratislava$/, { timeout: 3000 });
	}).toPass({ timeout: 20_000 });
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Bratislava');

	await context.setGeolocation({ latitude: 40.42, longitude: -3.7 });
	await page.goto('/?choose');
	const live = page.getByRole('link', { name: 'My location' });
	await expect(live).toContainText('Bratislava');
	await live.click();
	await expect(page).toHaveURL(/\/p\/40\.42,-3\.7\/Madrid$/);
	await page.goto('/?choose');
	await expect(page.getByRole('link', { name: 'My location' })).toHaveCount(1);
	await expect(page.getByRole('link', { name: 'My location' })).toContainText('Madrid');
});

test("today's details show dew point, visibility and fog ahead", async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const details = page.locator('section', { hasText: 'Today in detail' });
	await expect(details.getByText('Visibility')).toBeVisible();
	await expect(details.getByText('0.7 km')).toBeVisible();
	await expect(details.getByText('Fog likely until 13:00.')).toBeVisible();
	await page.goto('/p/1.29,103.85/Singapore');
	await expect(
		page.locator('section', { hasText: 'Today in detail' }).getByText(/· Oppressive$/)
	).toBeVisible();
});

test('carries 15-minute rain only where it is native, and never contradicts the hourly answer', async ({
	page,
	request
}) => {
	// Madrid's recorded quarter hours start dry while its hourly forecast says rain now: no line.
	const madrid = await (await request.get('/api/forecast?lat=40.42&lon=-3.7')).json();
	expect(madrid.nowcast[0]).toEqual({ time: '2026-11-10T10:00', rain: 0 });
	await page.goto('/p/40.42,-3.7/Madrid');
	await expect(page.getByText('Yes, all day.')).toBeVisible();
	await expect(page.getByText(/by the 15-minute forecast/)).toHaveCount(0);
	// Tromsø is outside every 15-minute model.
	const tromso = await (await request.get('/api/forecast?lat=69.65&lon=18.96')).json();
	expect(tromso.nowcast).toBeUndefined();
});

test('the wind tile tells the sea at the coast, and nothing inland', async ({ page }) => {
	await page.goto('/p/1.29,103.85/Singapore');
	const wind = page.locator('section', { hasText: 'How windy is it?' });
	await expect(wind.getByText(/^A calm sea today, waves up to 0\.\d m\./)).toBeVisible();
	await expect(wind.getByText(/The sea is 3\d°\./)).toBeVisible();
	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(page.getByText(/sea today/)).toHaveCount(0);
});

test("today's details show sunshine, and snow where there is some", async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const details = page.locator('section', { hasText: 'Today in detail' });
	await expect(details.getByText('Sunshine')).toBeVisible();
	await expect(details.getByText('Snow on the ground')).toHaveCount(0);
	await page.goto('/p/69.65,18.96/Troms%C3%B8');
	const north = page.locator('section', { hasText: 'Today in detail' });
	await expect(north.getByText('Snow on the ground')).toBeVisible();
	await expect(north.getByText('6 cm')).toBeVisible();
	// Tomorrow brings a little over a centimetre.
	await page.goto('/p/69.65,18.96/Troms%C3%B8?day=2026-11-11');
	await expect(page.getByText('Fresh snow')).toBeVisible();
});

test("today's details say what solar panels make, and when storms may come", async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const details = page.locator('section', { hasText: 'Today in detail' });
	await expect(details.getByText('About 0.3 kWh per kWp')).toBeVisible();
	await expect(details.getByText('Thunderstorms')).toHaveCount(0);
	// Singapore's air is unstable every day, with rain likely.
	await page.goto('/p/1.29,103.85/Singapore');
	const tropics = page.locator('section', { hasText: 'Today in detail' });
	await expect(tropics.getByText('Thunderstorms')).toBeVisible();
	await expect(tropics.getByText('Likely', { exact: true })).toBeVisible();
});

test('the health check answers for the uptime monitor, uncached', async ({ request }) => {
	const health = await request.get('/api/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toMatchObject({ status: 'ok' });
	expect(health.headers()['cache-control']).toBe('no-store');
	expect((await request.head('/api/health')).status()).toBe(200);
	// The check shares the forecast's cache entry; the forecast still adds the moon after it.
	const forecast = await (await request.get('/api/forecast?lat=48.15&lon=17.11')).json();
	expect(forecast.sky).toMatchObject({ fullMoon: expect.any(String) });
});

test("the forecast carries the country's public holidays in its days", async ({ request }) => {
	const forecast = await (await request.get('/api/forecast?lat=48.15&lon=17.11')).json();
	expect(forecast.holidays).toEqual({
		languages: ['sk'],
		days: [
			{
				date: '2026-11-17',
				localName: 'Deň boja za slobodu a demokraciu',
				name: 'Struggle for Freedom and Democracy Day'
			}
		]
	});
});

test('the reverse geocoder answers with a town name and checks its input', async ({ request }) => {
	const named = await request.get('/api/reverse?lat=69.65&lon=18.96&lang=en');
	expect(await named.json()).toEqual({ name: 'Tromsø' });
	expect(named.headers()['cache-control']).toContain('s-maxage=2592000');
	expect((await request.get('/api/reverse?lat=200&lon=0')).status()).toBe(400);
	expect((await request.get('/api/reverse?lat=1&lon=2&lang=xx')).status()).toBe(400);
});

test('compares two saved places day by day', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid');
	await savePlace(page);
	await page.goto('/p/48.15,17.11/Bratislava');
	await page.getByLabel('Compare with').selectOption({ label: 'Madrid' });
	await page.getByRole('button', { name: 'Compare', exact: true }).click();
	await expect(page).toHaveURL(
		/\/compare\?a=48\.15%2C17\.11&an=Bratislava&b=40\.42%2C-3\.7&bn=Madrid/
	);
	await expect(
		page.getByRole('heading', { level: 1, name: 'Bratislava or Madrid?' })
	).toBeVisible();
	await expect(page.getByText(/looks nicer on \d+ of the 10 days\.|About the same/)).toBeVisible();
	await expect(page.getByRole('row')).toHaveCount(11);
	await expectAccessible(page);
});

test('steps through saved places with previous and next', async ({ page }) => {
	await page.goto('/p/40.42,-3.7/Madrid');
	await savePlace(page);
	await page.goto('/p/69.65,18.96/Troms%C3%B8');
	await savePlace(page);
	// Saved newest first: Tromsø, Madrid.
	await page.getByRole('link', { name: 'Next place: Madrid' }).click();
	await expect(page).toHaveURL(/\/p\/40\.42,-3\.7\/Madrid$/);
	await page.getByRole('link', { name: 'Next place: Tromsø' }).click();
	await expect(page).toHaveURL(/Troms%C3%B8$/);
	await expectAccessible(page);

	// On the narrowest phones the arrows give way, so the place name keeps its room.
	await page.setViewportSize({ width: 320, height: 640 });
	await expect(page.getByRole('link', { name: /^Next place/ })).toBeHidden();
	const name = page.getByRole('link', { name: /Change place/ }).getByText('Tromsø');
	expect((await name.boundingBox())?.width).toBeGreaterThan(40);
});

test('warns the garden of frost after mild days, and says nothing otherwise', async ({ page }) => {
	await page.goto('/p/69.65,18.96/Troms%C3%B8');
	await placeReady(page);
	const garden = page.locator('section', { hasText: 'Does the garden need anything?' });
	await expect(
		garden.getByText('Ground frost on 7 of the next 7 days, first on Tuesday 10 November.')
	).toBeVisible();
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	await expect(page.getByText('Does the garden need anything?')).toHaveCount(0);
});

test('says when most of the last ten days were wet', async ({ page }) => {
	await page.goto('/p/1.29,103.85/Singapore');
	await placeReady(page);
	const dry = page.locator('section', { hasText: 'How dry has it been?' });
	await expect(dry.getByText('Rain on 8 of the last 10 days.')).toBeVisible();
});

test("says how good yesterday's forecast was", async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	const check = page.locator('section', { hasText: 'How good was the forecast?' });
	await expect(check.getByText("Yesterday's forecast for the high was 2° too warm.")).toBeVisible();
	await expect(check.getByText('Right on 27 of the last 30 days.')).toBeVisible();
});

test('says what tomorrow brings next to today', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const tomorrow = page.locator('section', { hasText: 'What about tomorrow?' });
	await expect(
		tomorrow.getByText('About as warm as today, up to 6°. Dry during the day.')
	).toBeVisible();
	await expect(tomorrow.getByText(/Low 3° · 23% chance of rain/)).toBeVisible();
});

test('explores the past from the "past years" tile', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	await page.getByRole('link', { name: 'Explore the past' }).click();
	await expect(page).toHaveURL(/\?history$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'Weather history in Bratislava' })
	).toBeVisible();
	// The last whole month before ERA5's newest day (the fixtures' 4 November 2026).
	const period = page.getByRole('region', { name: 'October 2026' });
	await expect(period.getByText(/^\d\.\d° warmer than usual\.$/)).toBeVisible();
	await expect(period.getByText(/^Drier than usual: .+ of rain, usually .+\.$/)).toBeVisible();
	const trend = page.getByRole('region', { name: 'How has the weather changed here?' });
	await expect(
		trend.getByText('Years here are now about 1.9° warmer than in 1961 to 1990.')
	).toBeVisible();
	await expect(
		trend.getByText(/^October has warmed by about .+ a decade since 1961\.$/)
	).toBeVisible();
	await expect(trend.getByRole('rowheader', { name: '2020–2025' })).toBeVisible();
	// The place in a line (F-28): its height and the Köppen zone of its normals.
	await expect(
		trend.getByText(
			'At 159 m above sea level, with a temperate oceanic climate (Cfb) by these normals.'
		)
	).toBeVisible();
	// The climate models' 2040s (X-20), fetched only when opened.
	await trend.getByText('And in the coming decades?').click();
	await expect(
		trend.getByText(
			/^Climate models expect the 2040s here to be about [\d.]+° warmer than 1995 to 2014, between [\d.]+° and [\d.]+° depending on the model\.$/
		)
	).toBeVisible();

	await page.getByRole('link', { name: 'Year', exact: true }).click();
	await expect(page.getByRole('region', { name: '2026' })).toContainText(
		'Recorded until 4 November 2026 so far'
	);
	await page.getByRole('link', { name: 'Earlier' }).click();
	await expect(page).toHaveURL(/\?history=year&at=2025-01-01$/);
	await expect(page.getByRole('region', { name: '2025' })).toBeVisible();
	await expect(page.getByRole('definition').filter({ hasText: '3 July 2025' })).toBeVisible();

	await page.getByRole('link', { name: 'Day', exact: true }).click();
	await page.getByLabel('Date').fill('2025-07-03');
	await page.getByRole('button', { name: 'Show' }).click();
	await expect(page).toHaveURL(/\?history=day&at=2025-07-03$/);
	await expect(page.getByRole('region', { name: '3 July 2025' })).toBeVisible();
	await expect(page.getByText(/^usually \d+°$/).first()).toBeVisible();
});

test('shares today as a picture, or downloads it where sharing files is not possible', async ({
	page
}) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Share today as a picture' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('skysense-2026-11-10.png');
	const png = Buffer.concat(await (await file.createReadStream()).toArray());
	// A PNG of 1080 × 1080 (width and height sit at bytes 16 to 23).
	expect(png.subarray(1, 4).toString()).toBe('PNG');
	expect(png.readUInt32BE(16)).toBe(1080);
	expect(png.readUInt32BE(20)).toBe(1080);
});

test('shows the rain radar, then the model, from the umbrella tile', async ({ page }) => {
	await blankMapTiles(page);
	await page.goto('/p/48.15,17.11/Bratislava');
	await page.getByRole('link', { name: 'Rain radar' }).click();
	await expect(page).toHaveURL(/\?radar$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'Rain radar around Bratislava' })
	).toBeVisible();
	await expect(page.getByText('The model shows rain within about 60 km from 10:00.')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Map of rain around Bratislava' })).toBeVisible();

	const slider = page.getByRole('slider', { name: 'Time' });
	await expect(slider).toHaveAttribute('aria-valuetext', '10:00, radar');
	await slider.focus();
	await page.keyboard.press('End');
	await expect(slider).toHaveAttribute('aria-valuetext', '13:00, model forecast');
	await expect(page.getByRole('button', { name: 'Next frame' })).toBeDisabled();
	await page.getByRole('button', { name: 'Previous frame' }).click();
	await expect(slider).toHaveAttribute('aria-valuetext', '12:00, model forecast');
	await expectAccessible(page);

	await page.getByRole('button', { name: 'Full screen' }).click();
	await page.getByRole('button', { name: 'Leave full screen' }).click();
	await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
});

test('the radar map switches to the model temperature, wind and cloud, said in words', async ({
	page
}) => {
	await blankMapTiles(page);
	await page.goto('/p/48.15,17.11/Bratislava?radar');
	const slider = page.getByRole('slider', { name: 'Time' });
	await expect(slider).toHaveAttribute('aria-valuetext', '10:00, radar');

	await page.getByText('Temperature', { exact: true }).click();
	await expect(page.getByText('Much the same temperature all around.')).toBeVisible();
	await expect(
		page.getByRole('region', { name: 'Map of temperature around Bratislava' })
	).toBeVisible();
	await expect(slider).toHaveAttribute('aria-valuetext', '10:00, model forecast');
	await slider.focus();
	await page.keyboard.press('End');
	await expect(slider).toHaveAttribute('aria-valuetext', '13:00, model forecast');
	await expect(page.getByText('Warmer to the south, by about 2°.')).toBeVisible();

	await page.getByText('Wind', { exact: true }).click();
	await expect(
		page.getByText('Wind from the southeast, up to 22 km/h within about 60 km.')
	).toBeVisible();
	await expectAccessible(page);

	await page.getByText('Clouds', { exact: true }).click();
	await expect(page.getByRole('region', { name: 'Map of cloud around Bratislava' })).toBeVisible();
	await expect(page.getByText('Much the same sky all around, about 100% cloud.')).toBeVisible();

	await page.getByText('Satellite', { exact: true }).click();
	await expect(
		page.getByRole('region', { name: 'Satellite picture around Bratislava' })
	).toBeVisible();
	await expect(
		page.getByText(/^NASA's satellite picture from .+, taken around midday\.$/)
	).toBeVisible();
	await expect(page.getByRole('slider', { name: 'Time' })).toHaveCount(0);

	await page.getByText('Rain', { exact: true }).click();
	await expect(page.getByText('The model shows rain within about 60 km from 10:00.')).toBeVisible();
	await expect(slider).toHaveAttribute('aria-valuetext', '10:00, radar');
});

test('the radar shows the other saved places and opens their radar', async ({ page }) => {
	await blankMapTiles(page);
	await page.goto('/p/48.21,16.37/Vienna');
	await savePlace(page);
	await page.goto('/p/48.15,17.11/Bratislava');
	await savePlace(page);
	await page.goto('/p/48.15,17.11/Bratislava?radar');
	const map = page.getByRole('region', { name: 'Map of rain around Bratislava' });
	await expect(map.getByRole('link', { name: 'Rain radar around Bratislava' })).toHaveCount(0);
	await expectAccessible(page);
	await map.getByRole('link', { name: 'Rain radar around Vienna' }).click();
	await expect(page).toHaveURL(/\/p\/48\.21,16\.37\/Vienna\?radar$/);
	await expect(page.getByRole('region', { name: 'Map of rain around Vienna' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Rain radar around Bratislava' })).toBeVisible();
});

test('the map shortcut opens the map around the last place, with search and both modes', async ({
	page
}) => {
	await blankMapTiles(page);
	await page.goto('/map');
	await expect(page).toHaveURL(/\/\?choose$/);
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	await page.goto('/map');
	await expect(page).toHaveURL(/\/map\/48\.15,17\.11\/Bratislava$/);
	await expect(page.getByRole('heading', { name: 'Map around Bratislava' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Map of rain around Bratislava' })).toBeVisible();

	await page.getByRole('link', { name: 'Where is it better?' }).click();
	await expect(page).toHaveURL(/\/map\/48\.15,17\.11\/Bratislava\?better$/);
	await expect(
		page.getByRole('application', { name: 'Map of scores around Bratislava' })
	).toBeVisible();

	await page.getByRole('combobox', { name: 'Search for a place' }).fill('Bratisl');
	await page
		.getByRole('option', { name: /Bratislava/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/map\/48\.\d+,17\.\d+\/Bratislava$/);

	// A click on the radar opens the forecast at that point (M-04).
	const radar = page.getByRole('region', { name: /^Map of rain around/ });
	await expect(radar).toHaveClass(/leaflet-container/);
	await radar.click({ position: { x: 60, y: 120 } });
	await expect(page).toHaveURL(/\/p\/4\d\.\d+,1\d\.\d+/);
});

test('a commute set in Settings gets its line in the umbrella tile', async ({ page }) => {
	await page.goto('/settings');
	await page.getByLabel('Leaving').fill('07:30');
	await page.getByLabel('Coming back').fill('17:30');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toHaveText('Settings saved.');
	await expect(page.getByLabel('Coming back')).toHaveValue('17:30');

	// The recorded morning is Tuesday 10:00, so only the trip home is still ahead, after the rain.
	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(page.getByText('Your trip at 17:30 today looks dry.')).toBeVisible();

	await page.goto('/settings');
	await page.getByLabel('Leaving').fill('');
	await page.getByLabel('Coming back').fill('');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(page.getByText(/looks dry|Rain is likely for your trip/)).toHaveCount(0);
});

test('settings change units and language', async ({ page }) => {
	await page.goto('/settings');
	await expectAccessible(page);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	await page.getByText('Fahrenheit (°F)').click();
	await page.getByText('Light', { exact: true }).click();
	await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status')).toHaveText('Einstellungen gespeichert.');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

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
	const tile = page.locator('section', { hasText: 'When should I go out?' });
	// That day's own windows, without a weekday: the heading already names the day.
	await expect(tile.getByRole('listitem').filter({ hasText: 'Run' })).toContainText(
		'12:00 to 13:00'
	);
	await expect(page.getByText('Do I need an umbrella?')).toBeVisible();
	await expect(page.getByText('Now', { exact: true })).toHaveCount(0);

	// Icon-only arrows say on hover where they go, not only to screen readers.
	await expect(page.getByRole('link', { name: 'Next day: Friday 13 November' })).toHaveAttribute(
		'title',
		'Next day: Friday 13 November'
	);
	await page.getByRole('link', { name: 'Next day: Friday 13 November' }).click();
	await expect(page).toHaveURL(/\?day=2026-11-13$/);
	await page.getByRole('link', { name: 'Previous day: Thursday 12 November' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Thursday 12 November' })).toBeVisible();

	await page.getByRole('link', { name: 'Back to the forecast' }).click();
	await expect(page.getByText('10-day forecast')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Map', exact: true }).first()).toHaveAttribute(
		'href',
		'/map/48.15,17.11/Bratislava'
	);
});

test('the wall display keeps the last forecast when the network goes', async ({ page }) => {
	// The recorded forecast's own morning, so its hours are still ahead (10:20 in Bratislava).
	await page.clock.install({ time: new Date('2026-11-10T09:20:00Z') });
	await page.goto('/wall/48.15,17.11/Bratislava');
	await expect(page.getByText('10:20')).toBeVisible();
	const hours = page.getByRole('region', { name: 'Next 12 hours' });
	await expect(hours.getByRole('listitem')).toHaveCount(7);

	await page.route('**/api/forecast**', (route) => route.abort());
	await page.clock.fastForward('10:00');
	await expect(page.getByRole('status')).toContainText('Offline');
	await expect(hours.getByRole('listitem').first()).toContainText('Now');
	await expect(page.getByRole('link', { name: 'Bratislava' })).toHaveAttribute(
		'href',
		'/p/48.15,17.11/Bratislava'
	);
});

test('the wall display shows what its address asks for, set up from its panel', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-11-10T09:20:00Z') });
	await page.goto('/wall/48.15,17.11/Bratislava?show=clock&show=now&size=l');
	await expect(page.getByText('10:20')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Next 12 hours' })).toHaveCount(0);
	await expect(page.getByText('Tuesday 10 November')).toHaveCount(0);

	await page.mouse.move(200, 200);
	await page.getByRole('button', { name: 'Customize this screen' }).click();
	const panel = page.getByRole('dialog', { name: 'Customize this screen' });
	await expect(panel.getByRole('checkbox', { name: 'Clock' })).toBeChecked();
	await expect(panel.getByRole('checkbox', { name: 'Date' })).not.toBeChecked();
	await expectAccessible(page);

	await panel.getByRole('link', { name: 'Forecast' }).click();
	await expect(page).toHaveURL(/show=tomorrow/);
	await expect(page).toHaveURL(/size=l/);
	await expect(page.getByText('What about tomorrow?')).toBeVisible();
	await expect(page.getByText('10:20')).toHaveCount(0);

	// Ticking boxes saves them into the address.
	await page.getByRole('button', { name: 'Customize this screen' }).click();
	await panel.getByRole('checkbox', { name: 'Date' }).check();
	await panel.getByText('Small', { exact: true }).click();
	await panel.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/show=date.*size=s/);
	await expect(page.getByText('Tuesday 10 November')).toBeVisible();
});

test("the wall display's sentence turns to tomorrow after sunset", async ({ page }) => {
	// 19:00 in Bratislava, after the 16:19 sunset.
	await page.clock.install({ time: new Date('2026-11-10T18:00:00Z') });
	await page.goto('/wall/48.15,17.11/Bratislava');
	await expect(page.getByText('What about tomorrow?')).toBeVisible();
	await expect(
		page.getByText('About as warm as today, up to 6°. Dry during the day.')
	).toBeVisible();
});

test('the map shows where the weather is better and opens a square from the keyboard', async ({
	page
}) => {
	await blankMapTiles(page);
	await page.goto('/p/40.42,-3.7/Madrid');
	await page.getByRole('link', { name: 'Where is it better?' }).click();
	await expect(
		page.getByRole('heading', { name: 'Where is the weather better around Madrid?' })
	).toBeVisible({ timeout: 15_000 });
	await page.getByLabel('Activity').selectOption('run');
	// The grid and the best square's name are two requests after the view loads; a busy machine
	// (the full suite on mobile) needs longer than the default 5 seconds for them.
	await expect(page.getByText(/Better around .+, 50 km south: 10:00 to 11:00/)).toBeVisible({
		timeout: 15_000
	});

	const map = page.getByRole('application', { name: 'Map of scores around Madrid' });
	await expect(map).toHaveClass(/leaflet-container/);
	// Hovering a square moves the cursor to it; a pointer left resting on the map would make the
	// arrow keys start from that square instead of the middle.
	await page.mouse.move(0, 0);
	await map.focus();
	await expect(page.getByText(/^Here: score \d+/)).toBeVisible();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByText(/^\d+ km south: score \d+/)).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/p\/40\.2,-3\.7/);
});

test('the week page says which day is best and shows every day by the hour', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await page.getByRole('link', { name: 'The week, hour by hour' }).click();
	await expect(page.getByRole('heading', { name: 'The week in Bratislava' })).toBeVisible();
	await expect(
		page.getByText(/^Run: best on \w+ \d+ November, \d\d:00 to \d\d:00\.$/)
	).toBeVisible();
	const days = page.getByRole('link', { name: /^(Today|\w+day \d+ November)$/ });
	await expect(days).toHaveCount(10);
	await days.nth(1).click();
	await expect(page).toHaveURL(/\?day=2026-11-11$/);
});

test('arranges the tiles and keeps the layout', async ({ page }, testInfo) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const order = () =>
		page
			.locator('[data-tile]')
			.evaluateAll((tiles) => tiles.map((t) => t.getAttribute('data-tile')));
	await page.getByRole('button', { name: 'Arrange tiles' }).click();

	await page.getByRole('button', { name: 'Hide: How windy is it?' }).click();
	await expect(page.getByRole('button', { name: 'Show: How windy is it?' })).toBeVisible();
	await page.getByRole('button', { name: 'Move up: 10-day forecast' }).click();
	expect((await order()).slice(3, 6)).toEqual(['chart', 'days', 'tomorrow']);

	// Dragging by the handle onto another tile takes that tile's place.
	const handle = page.getByRole('button', { name: 'Drag to move: Today in detail' });
	// Mid-screen, clear of the edit bar pinned to the bottom, and pressed through hover, which fails
	// if anything covers the handle.
	await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await handle.hover();
	const from = (await handle.boundingBox())!;
	await page.mouse.down();
	if (testInfo.project.name === 'mobile') {
		// One tall column: held at the top edge, the page scrolls and the tile passes those above.
		await page.mouse.move(from.x + from.width / 2, 8, { steps: 8 });
	} else {
		// Two columns: the full-width tile above is on screen, so the drag goes straight onto it.
		const target = (await page.locator('[data-tile="tomorrow"]').boundingBox())!;
		await page.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 8 });
	}
	await expect
		.poll(async () => (await order()).indexOf('details') < (await order()).indexOf('tomorrow'))
		.toBe(true);
	await page.mouse.up();

	await page.getByRole('button', { name: 'Done' }).click();
	await page.reload();
	await expect(page.getByText('How windy is it?')).toHaveCount(0);
	expect((await order()).indexOf('details')).toBeLessThan((await order()).indexOf('tomorrow'));

	// Settings brings a hidden tile back without touching the order.
	await page.goto('/settings');
	const wind = page.getByRole('checkbox', { name: 'How windy is it?' });
	await expect(wind).not.toBeChecked();
	await wind.check();
	await page.getByRole('button', { name: 'Save' }).click();
	await page.goto('/p/48.15,17.11/Bratislava');
	await expect(page.getByText('How windy is it?')).toBeVisible();
	expect((await order()).indexOf('details')).toBeLessThan((await order()).indexOf('tomorrow'));

	await page.goto('/settings');
	await page.getByRole('button', { name: 'Reset the layout' }).click();
	await page.goto('/p/48.15,17.11/Bratislava');
	expect(await order()).toEqual([
		'umbrella',
		'activities',
		'hours',
		'chart',
		'tomorrow',
		'days',
		'map',
		'details',
		'charts',
		'wind',
		'dark',
		'past'
	]);
});

test('shows the map and the wind and UV charts when scrolled near', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	const map = page.locator('[data-tile="map"]');
	await map.scrollIntoViewIfNeeded();
	await expect(map.getByText(/^Radar picture from \d\d:\d\d\.$/)).toBeVisible();
	await expect(map.getByRole('link', { name: 'Open the map' })).toHaveAttribute(
		'href',
		'/map/48.15,17.11/Bratislava'
	);

	const charts = page.locator('[data-tile="charts"]');
	await charts.scrollIntoViewIfNeeded();
	await expect(charts.getByText(/^Gusts up to \d+ km\/h around \d\d:\d\d\.$/)).toBeVisible();
	// A tap on a chart reads out that hour; the first point is the first hour.
	await charts
		.locator('svg.cursor-crosshair')
		.first()
		.click({ position: { x: 1, y: 40 } });
	await expect(charts.getByText(/^\d\d:\d\d: wind \d+ km\/h, gusts \d+ km\/h$/)).toBeVisible();
	await charts.getByText('Show as a table').click();
	await expect(charts.getByRole('row')).toHaveCount(26);
	await expectAccessible(page);
});
