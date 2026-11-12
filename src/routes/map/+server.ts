import { redirect } from '@sveltejs/kit';
import { LAST_PLACE_COOKIE, parseLastPlace } from '#lib/places.svelte.js';
import type { RequestHandler } from './$types';

// `/map` opens the radar for the last place (the app shortcut points here), or the place picker
// when there is none yet.
export const GET: RequestHandler = ({ cookies }) => {
	const last = parseLastPlace(cookies.get(LAST_PLACE_COOKIE));
	redirect(307, last ? `/p/${last.coords}/${encodeURIComponent(last.name)}?radar` : '/?choose');
};
