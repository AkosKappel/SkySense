import { redirect } from '@sveltejs/kit';
import { LAST_PLACE_COOKIE, parseLastPlace } from '#lib/places.svelte.js';
import type { PageServerLoad } from './$types';

// `/` reopens the last place, so a returning visitor lands on their forecast. `?choose` shows the
// place picker instead.
export const load: PageServerLoad = ({ cookies, url }) => {
	if (url.searchParams.has('choose')) return;
	const last = parseLastPlace(cookies.get(LAST_PLACE_COOKIE));
	if (last) redirect(307, `/p/${last.coords}/${encodeURIComponent(last.name)}`);
};
