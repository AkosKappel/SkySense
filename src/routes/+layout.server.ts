import {
	COMFORT_COOKIE,
	defaultUnits,
	readComfort,
	readUnits,
	UNITS_COOKIE
} from '#lib/settings.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies, request }) => ({
	units: readUnits(cookies.get(UNITS_COOKIE), defaultUnits(request.headers.get('accept-language'))),
	comfort: readComfort(cookies.get(COMFORT_COOKIE))
});
