import type { HandleClientError } from '@sveltejs/kit/hooks';

/** The browser's side of T-14: the same short id on the error page, logged to the console. */
export const handleError: HandleClientError = ({ kind, error }) => {
	if (kind !== 'unknown') return;
	const id = crypto.randomUUID().slice(0, 8);
	console.error(`[${id}]`, error);
	return { id };
};
