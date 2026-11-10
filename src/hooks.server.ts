import { sequence, type Handle, type HandleServerError } from '@sveltejs/kit/hooks';
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

/**
 * Unexpected errors get a short id, logged with the route (not the URL, which names a place) and
 * shown on the error page, so a report can be matched with the Vercel logs.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	// App errors (`error(404, ...)`) and SvelteKit's own (an unknown route) are expected.
	if (kind !== 'unknown') return;
	const id = crypto.randomUUID().slice(0, 8);
	console.error(`[${id}] ${event.request.method} ${event.route.id ?? 'unknown route'}`, error);
	return { id };
};
