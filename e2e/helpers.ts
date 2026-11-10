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
 * Waits until a place page runs in the browser: the climate tile is fetched by the browser after
 * hydration, so once it shows, clicks reach their handlers instead of the links' fallbacks.
 */
export async function placeReady(page: Page) {
	await expect(page.getByText('Is this normal for the time of year?')).toBeVisible();
}
