import { expect, type Page } from '@playwright/test';

/**
 * Saves the open place. A click before the page has hydrated does nothing, so the click is
 * retried until the Save button is gone (it only goes once the place is saved).
 */
export async function savePlace(page: Page) {
	const save = page.getByRole('button', { name: 'Save' });
	await expect(async () => {
		// A click that did save can take a moment to show, so only click while the button is there.
		if (await save.count()) await save.click({ timeout: 2000 });
		await expect(save).toHaveCount(0, { timeout: 2000 });
	}).toPass({ timeout: 20000 });
}

/**
 * Waits until a place page runs in the browser: the climate tile loads only in the browser, once
 * it is scrolled near, so once it shows, clicks reach their handlers instead of the links'
 * fallbacks. Scrolls down to load it, then back to the top.
 */
export async function placeReady(page: Page) {
	const normal = page.getByText('Is this normal for the time of year?');
	await expect(async () => {
		await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
		await expect(normal).toBeVisible({ timeout: 2000 });
	}).toPass({ timeout: 20000 });
	await page.evaluate(() => scrollTo(0, 0));
}

const blankPng = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

/** Answers radar and base map tiles with a blank image, so tests never reach those services. */
export async function blankMapTiles(page: Page) {
	await page.route(
		/^https:\/\/(tilecache\.rainviewer\.com|[a-d]\.basemaps\.cartocdn\.com)\//,
		(route) => route.fulfill({ contentType: 'image/png', body: blankPng })
	);
}
