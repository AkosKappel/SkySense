import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Every axe rule, WCAG 2.2 AA and best practices; the violations list must be empty. */
export async function expectAccessible(page: Page) {
	const results = await new AxeBuilder({ page }).analyze();
	expect(
		results.violations.map(
			(v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
		)
	).toEqual([]);
}
