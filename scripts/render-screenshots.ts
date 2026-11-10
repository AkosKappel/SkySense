// Renders the README screenshots (P-05) from the recorded fixtures, so they are the same on every
// run. Start the app first: `pnpm build && SKYSENSE_FIXTURES=1 pnpm preview`, then
// `node scripts/render-screenshots.ts`.
import { chromium, type Page } from '@playwright/test';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';

const browser = await chromium.launch();

async function shot(
	name: string,
	path: string,
	viewport: { width: number; height: number },
	prepare?: (page: Page) => Promise<void>
) {
	// Phones at 2x like a real screen; desktop at 1x keeps the files small.
	const deviceScaleFactor = viewport.width < 800 ? 2 : 1;
	const page = await browser.newPage({ viewport, deviceScaleFactor, locale: 'en-GB' });
	await page.goto(BASE + path, { waitUntil: 'networkidle' });
	await prepare?.(page);
	await page.screenshot({ path: `${OUT}/${name}.png` });
	await page.close();
	console.log('wrote', `${OUT}/${name}.png`);
}

const phone = { width: 390, height: 844 };
await shot('mobile-overview', '/p/48.15,17.11/Bratislava', phone);
await shot('mobile-activities', '/p/48.15,17.11/Bratislava', phone, async (page) => {
	const tile = page.locator('section', { hasText: 'When should I go out?' });
	await tile.locator('summary').first().click();
	await tile.evaluate((el) => el.scrollIntoView({ block: 'start' }));
	await page.evaluate(() => scrollBy(0, -16));
});
await shot('mobile-night', '/p/69.35,88.2/Norilsk', phone);
await shot('desktop', '/p/48.15,17.11/Bratislava', { width: 1440, height: 900 });
await shot('desktop-models', '/p/40.42,-3.7/Madrid?models', { width: 1440, height: 900 });

await browser.close();
