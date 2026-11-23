import { redirect } from '@sveltejs/kit';
import { cookieMaxAge, cookieName, isLocale } from '#lib/paraglide/runtime.js';
import { COMMUTE_COOKIE, writeCommute } from '#lib/commute.js';
import { COMFORT_COOKIE, readComfort, readUnits, UNITS_COOKIE } from '#lib/settings.js';
import { readTheme, THEME_COOKIE } from '#lib/theme.js';
import { readTiles, TILES_COOKIE, writeTiles } from '#lib/tiles.js';
import { metric } from '#lib/units.js';
import type { Actions } from './$types';

const cookie = { path: '/', maxAge: cookieMaxAge, sameSite: 'lax', httpOnly: false } as const;

// A plain form post, so settings work without JavaScript; the redirect reloads the page in the
// chosen language.
export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const units = readUnits(
			JSON.stringify({
				temperature: form.get('temperature'),
				wind: form.get('wind'),
				rain: form.get('rain'),
				clock: form.get('clock')
			}),
			metric
		);
		cookies.set(UNITS_COOKIE, JSON.stringify(units), cookie);
		cookies.set(COMFORT_COOKIE, readComfort(String(form.get('comfort'))), cookie);
		cookies.set(THEME_COOKIE, readTheme(String(form.get('theme'))), cookie);
		cookies.set(COMMUTE_COOKIE, writeCommute(form.get('leave'), form.get('back')), cookie);

		// Ticked tiles show; the order and widths from the place page's edit mode stay as they are.
		if (form.get('tiles') === 'reset') {
			cookies.delete(TILES_COOKIE, { path: '/' });
		} else {
			const shown = form.getAll('tile');
			const tiles = readTiles(cookies.get(TILES_COOKIE)).map((t) => ({
				...t,
				hidden: !shown.includes(t.id)
			}));
			cookies.set(TILES_COOKIE, writeTiles(tiles), cookie);
		}

		const language = form.get('language');
		if (typeof language === 'string' && isLocale(language)) {
			cookies.set(cookieName, language, cookie);
		}
		redirect(303, '/settings?saved');
	}
};
