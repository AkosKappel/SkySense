import { redirect } from '@sveltejs/kit';
import { cookieMaxAge, cookieName, isLocale } from '#lib/paraglide/runtime.js';
import { localPath } from '#lib/settings.js';
import type { RequestHandler } from './$types';

// The footer's language links (U-17): plain links, so they work without JavaScript. The same
// cookie as the language in Settings, then back to the page the reader was on.
export const GET: RequestHandler = ({ params, url, cookies }) => {
	if (isLocale(params.locale)) {
		cookies.set(cookieName, params.locale, {
			path: '/',
			maxAge: cookieMaxAge,
			sameSite: 'lax',
			httpOnly: false
		});
	}
	redirect(303, localPath(url.searchParams.get('to')));
};
