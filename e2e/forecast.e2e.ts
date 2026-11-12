import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe.js';
import { blankMapTiles, placeReady, savePlace } from './helpers.js';

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
	// The server keeps forecasts for a few minutes, so later in a run this place can be a minute old.
	await expect(page.getByText(/^Updated (just now|\d+ minutes? ago)$/)).toBeVisible();
	await expect(page.getByText(/From the east · 12 km\/h/)).toBeVisible();
	await expect(
		page.locator('section', { hasText: 'When does it get dark?' }).getByText('16:19')
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
	const normal = page.locator('section', { hasText: 'Is this normal for the time of year?' });
	await expect(normal.getByText(/than usual\.|About normal/)).toBeVisible();
	await expect(normal.getByText(/\(1991 to 2020\)/)).toBeVisible();
	const past = page.locator('section', { hasText: 'What was this day like in past years?' });
	await expect(past.getByRole('rowheader', { name: '2025' })).toBeVisible();
	await expect(past.getByRole('rowheader', { name: '2016' })).toBeVisible();
	await expectAccessible(page);
});

test('says how long it has been dry', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
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

test('the status bar colour follows the sky', async ({ page }) => {
	await page.goto('/p/69.35,88.2/Norilsk');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111827');
	await page.goto('/settings');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1e1b4b');
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
	await page.getByRole('button', { name: 'Use my location' }).click();
	await expect(page).toHaveURL(/\/p\/48\.15,17\.11\/Bratislava$/);
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

test('the health check answers for the uptime monitor, uncached', async ({ request }) => {
	const health = await request.get('/api/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toMatchObject({ status: 'ok' });
	expect(health.headers()['cache-control']).toBe('no-store');
	expect((await request.head('/api/health')).status()).toBe(200);
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

test('shows the past year from the "past years" tile', async ({ page }) => {
	await page.goto('/p/48.15,17.11/Bratislava');
	await page.getByRole('link', { name: 'The past year in Bratislava' }).click();
	await expect(page).toHaveURL(/\?year$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'The past year in Bratislava' })
	).toBeVisible();
	await expect(page.getByRole('definition').filter({ hasText: '29 June 2026' })).toBeVisible();
	await expect(page.getByText(/of rain in total; \d+ days had at least 1\.0 mm\./)).toBeVisible();
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

test('the radar map switches to the model temperature and wind, said in words', async ({
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

test('the map shortcut opens the radar for the last place', async ({ page }) => {
	await page.goto('/map');
	await expect(page).toHaveURL(/\/\?choose$/);
	await page.goto('/p/48.15,17.11/Bratislava');
	await placeReady(page);
	await page.goto('/map');
	await expect(page).toHaveURL(/\/p\/48\.15,17\.11\/Bratislava\?radar$/);
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
	const tile = page.locator('section', { hasText: 'When should I go out?' });
	// That day's own windows, without a weekday: the heading already names the day.
	await expect(tile.getByRole('listitem').filter({ hasText: 'Run' })).toContainText(
		'12:00 to 13:00'
	);
	await expect(page.getByText('Do I need an umbrella?')).toBeVisible();
	await expect(page.getByText('Now', { exact: true })).toHaveCount(0);

	await page.getByRole('link', { name: 'Back to the forecast' }).click();
	await expect(page.getByText('10-day forecast')).toBeVisible();
});
