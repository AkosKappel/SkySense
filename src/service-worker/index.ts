// Offline support (P-01): the app shell is precached; pages and API answers are network first,
// and the last copy of each is kept, so a place opened before still shows offline with the age
// of its forecast ("Updated 3 hours ago").
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';

const CACHE = `skysense-${version}`;
// Paths are relative to the base path; the social preview image is for other sites, not the app.
const ASSETS = new Set(
	[...immutable, ...assets].map(({ path }) => `/${path}`).filter((path) => path !== '/og.png')
);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...ASSETS])));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
	);
});

/** Pages and API answers kept for offline use, per kind; the oldest go first. */
const KEEP = 40;

async function trim(cache: Cache, request: Request) {
	// "/api/forecast" or "/p": each API endpoint, and pages, keep their own forty.
	const path = new URL(request.url).pathname;
	const kind = path
		.split('/')
		.slice(0, path.startsWith('/api/') ? 3 : 2)
		.join('/');
	const same = (await cache.keys()).filter(
		(key) => !ASSETS.has(new URL(key.url).pathname) && new URL(key.url).pathname.startsWith(kind)
	);
	// Cache keys keep insertion order, so the first ones are the oldest.
	await Promise.all(same.slice(0, Math.max(0, same.length - KEEP)).map((key) => cache.delete(key)));
}

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.ok) {
			await cache.put(request, response.clone());
			await trim(cache, request);
		}
		return response;
	} catch (cause) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw cause;
	}
}

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;

	if (ASSETS.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((cached) => cached ?? fetch(event.request)));
		return;
	}
	if (event.request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
		event.respondWith(networkFirst(event.request));
	}
});
