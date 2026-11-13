import { expect, test } from '@playwright/test';
import config from '../lighthouserc.json' with { type: 'json' };

// The script budgets that Lighthouse enforces in CI, checked here first so `pnpm test:e2e` fails
// before a push does. Lighthouse counts each script's transfer size, headers included, which is
// what Resource Timing reports. It reads a little more (about 2 kB on the place page), so this
// keeps a margin below its limit.
const MARGIN = 3 * 1024;

type Assertion = { matchingUrlPattern: string; assertions: Record<string, unknown> };
const budgets = (config.ci.assert.assertMatrix as Assertion[]).flatMap((entry) => {
	const size = entry.assertions['resource-summary:script:size'] as
		[string, { maxNumericValue: number }] | undefined;
	return size
		? [{ pattern: new RegExp(entry.matchingUrlPattern), max: size[1].maxNumericValue }]
		: [];
});

for (const url of config.ci.collect.url) {
	const budget = budgets.find(({ pattern }) => pattern.test(url));
	if (!budget) continue;
	const path = url.replace(/^http:\/\/[^/]+/, '');

	test(`${path} stays inside its script budget`, async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'desktop', 'Lighthouse measures the desktop build once');
		await page.goto(path, { waitUntil: 'networkidle' });
		const scripts = await page.evaluate(() =>
			performance
				.getEntriesByType('resource')
				.filter((entry) => entry.name.endsWith('.js'))
				.reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0)
		);
		expect(scripts).toBeLessThanOrEqual(budget.max - MARGIN);
	});
}
