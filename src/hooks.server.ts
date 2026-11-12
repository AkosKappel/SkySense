import { json } from '@sveltejs/kit';
import { sequence, type Handle, type HandleServerError } from '@sveltejs/kit/hooks';
import { SKYSENSE_FIXTURES } from '$app/env/private';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { rateLimiter } from '#lib/server/rate-limit.js';

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
	// The embeddable card (X-12) is the one page other sites may frame. It has no actions to
	// trick anyone into, and its links open in a new tab.
	if (event.url.pathname.startsWith('/embed/')) {
		const csp = response.headers.get('content-security-policy');
		if (csp) {
			response.headers.set(
				'content-security-policy',
				csp.replace("frame-ancestors 'none'", 'frame-ancestors *')
			);
		}
	}
	// Vercel's own hosts copy the site; only the real domain should be found by search engines.
	if (event.url.hostname.endsWith('.vercel.app')) response.headers.set('x-robots-tag', 'noindex');
	return response;
};

// A page view makes about five API requests (the forecast while rendering, then climate, recent
// rain and the like); the radar a few more. 120 a minute leaves room for quick browsing.
const limitApi = rateLimiter(120, 60_000);

const handleRateLimit: Handle = ({ event, resolve }) => {
	// Recorded answers cost no quota, and the tests make many requests from one address.
	if (!event.url.pathname.startsWith('/api/') || SKYSENSE_FIXTURES) return resolve(event);
	const { allowed, retryAfter } = limitApi(event.getClientAddress());
	if (allowed) return resolve(event);
	return json(
		{ message: 'Too many requests' },
		{ status: 429, headers: { 'retry-after': String(retryAfter), 'cache-control': 'no-store' } }
	);
};

export const handle: Handle = sequence(handleSecurity, handleRateLimit, handleParaglide);

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
