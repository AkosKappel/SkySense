import type { RequestHandler } from './$types';

// Generated, so the sitemap link carries whichever domain serves the app.
export const GET: RequestHandler = ({ url }) =>
	new Response(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, {
		headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=86400' }
	});
