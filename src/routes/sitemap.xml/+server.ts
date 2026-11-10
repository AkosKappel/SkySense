import type { RequestHandler } from './$types';

// Only the public pages: place pages are personal and carry `noindex`.
const PAGES = ['/', '/about', '/privacy'];

export const GET: RequestHandler = ({ url }) => {
	const urls = PAGES.map((path) => `\t<url><loc>${url.origin}${path}</loc></url>`).join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=86400' } }
	);
};
