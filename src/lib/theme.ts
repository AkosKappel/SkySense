// The colour theme (U-05): dark, light, or the system's choice. Stored in a cookie so the server
// renders the page in it and nothing flashes.

export const THEME_COOKIE = 'skysense_theme';
export const themes = ['system', 'dark', 'light'] as const;
export type Theme = (typeof themes)[number];

export function readTheme(cookie: string | undefined): Theme {
	return themes.find((theme) => theme === cookie) ?? 'system';
}

/** Whether the page shows light colours now, for what CSS cannot reach (canvas, theme-color). */
export function isLight(): boolean {
	const theme = document.documentElement.dataset.theme;
	if (theme === 'light') return true;
	if (theme === 'dark') return false;
	return matchMedia('(prefers-color-scheme: light)').matches;
}
