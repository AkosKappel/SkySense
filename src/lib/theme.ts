// The colour theme (U-05): dark, light, the system's choice, the weather's (U-13), or paper (U-15). Stored in a
// cookie so the server renders the page in it and nothing flashes.
import type { SkyKind } from '#lib/sky.js';

export const THEME_COOKIE = 'skysense_theme';
export const themes = ['system', 'dark', 'light', 'weather', 'paper'] as const;
export type Theme = (typeof themes)[number];

export function readTheme(cookie: string | undefined): Theme {
	return themes.find((theme) => theme === cookie) ?? 'system';
}

/**
 * "Like the weather" (U-13): the light palette under a clear daytime sky, the dark glass under
 * clouds, rain, storms and at night. It only picks between the two palettes sky.test.ts checks.
 */
export const weatherScheme = (kind: SkyKind): 'light' | 'dark' =>
	kind === 'day-clear' || kind === 'dawn' ? 'light' : 'dark';

/** Whether the page shows light colours now, for what CSS cannot reach (canvas, theme-color). */
export function isLight(): boolean {
	const theme = document.documentElement.dataset.theme;
	if (theme === 'light' || theme === 'paper') return true;
	if (theme === 'dark') return false;
	return matchMedia('(prefers-color-scheme: light)').matches;
}
