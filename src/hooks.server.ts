import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				// The Latin subset is on every page, so fetch it with the HTML instead of after the CSS;
				// Slovak and Hungarian also need Latin Extended (č, ő). Other subsets load on demand.
				preload: ({ type, path }) =>
					type === 'js' ||
					type === 'css' ||
					(type === 'font' &&
						(path.includes('-latin-wght') ||
							((locale === 'sk' || locale === 'hu') && path.includes('-latin-ext-wght')))),
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		);
	});

// The CSP comes from `csp` in vite.config.ts; these are the headers SvelteKit does not set.
export const securityHeaders: Record<string, string> = {
	'referrer-policy': 'strict-origin-when-cross-origin',
	'x-content-type-options': 'nosniff',
	'permissions-policy': 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
	'cross-origin-opener-policy': 'same-origin'
};

const handleSecurity: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
};

export const handle: Handle = sequence(handleSecurity, handleParaglide);
