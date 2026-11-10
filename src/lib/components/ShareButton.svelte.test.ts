import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ShareButton from './ShareButton.svelte';

describe('ShareButton', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('uses the share sheet where the browser has one', async () => {
		const share = vi.fn(async () => {});
		vi.stubGlobal('navigator', { ...navigator, share });
		const screen = render(ShareButton, { title: 'Weather in Madrid' });
		await screen.getByRole('button', { name: 'Share' }).click();
		expect(share).toHaveBeenCalledWith({ title: 'Weather in Madrid', url: location.href });
	});

	it('copies the link and says so elsewhere', async () => {
		const writeText = vi.fn(async () => {});
		vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
		const screen = render(ShareButton, { title: 'Weather in Madrid' });
		await screen.getByRole('button', { name: 'Share' }).click();
		await expect.element(screen.getByText('Link copied.')).toBeVisible();
		expect(writeText).toHaveBeenCalledWith(location.href);
	});

	it('says when the link could not be copied', async () => {
		const writeText = vi.fn(async () => Promise.reject(new Error('denied')));
		vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
		const screen = render(ShareButton, { title: 'Weather in Madrid' });
		await screen.getByRole('button', { name: 'Share' }).click();
		await expect.element(screen.getByText('The link could not be copied.')).toBeVisible();
	});
});
