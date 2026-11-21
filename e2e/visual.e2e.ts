import { expect, test } from '@playwright/test';
import { blankMapTiles, placeReady } from './helpers.js';

// Visual regression (T-20): the main pages at phone and desktop width in both themes, from the
// recorded fixtures with motion off, so layout bugs that pass every other test (a clipped list, an
// empty column, a bar outside its chart) show up as a changed picture. Fonts render differently on
// other systems, so the snapshots are Linux only, like CI. Update them on purpose with
// `pnpm test:e2e visual --update-snapshots` and look at every changed image before committing.
test.skip(process.platform !== 'linux', 'Snapshots are rendered on Linux');

test.beforeEach(({ page }) => blankMapTiles(page));

const pages = [
	{ name: 'place', path: '/p/48.15,17.11/Bratislava', place: true },
	{ name: 'day', path: '/p/48.15,17.11/Bratislava?day=2026-11-12', place: false },
	{ name: 'week', path: '/p/48.15,17.11/Bratislava?week', place: false },
	{
		name: 'compare',
		path: '/compare?a=48.15,17.11&an=Bratislava&b=40.42,-3.7&bn=Madrid',
		place: false
	},
	{ name: 'settings', path: '/settings', place: false }
];

for (const colorScheme of ['dark', 'light'] as const) {
	for (const { name, path, place } of pages) {
		test(`${name} looks the same in the ${colorScheme} theme`, async ({ page }) => {
			await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
			await page.goto(path, { waitUntil: 'networkidle' });
			// The place page's browser-loaded tiles (climate, dry spell, forecast check) come in late.
			if (place) await placeReady(page);
			await expect(page).toHaveScreenshot(`${name}-${colorScheme}.png`, {
				fullPage: true,
				animations: 'disabled',
				maxDiffPixelRatio: 0.01
			});
		});
	}
}
