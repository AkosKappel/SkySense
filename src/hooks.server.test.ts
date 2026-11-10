import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleError } from './hooks.server.js';

const event = {
	request: new Request('http://localhost/p/48.15,17.11/Bratislava'),
	route: { id: '/p/[coords]/[[name]]' }
} as unknown as RequestEvent;

describe('handleError', () => {
	afterEach(() => vi.restoreAllMocks());

	it('logs an unexpected error with a short id and the route, not the place', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = (await handleError({ kind: 'unknown', error: new Error('boom'), event })) as {
			id: string;
		};
		expect(result.id).toMatch(/^[0-9a-f]{8}$/);
		const line = String(log.mock.calls[0][0]);
		expect(line).toBe(`[${result.id}] GET /p/[coords]/[[name]]`);
	});

	it('leaves expected errors such as unknown pages alone', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await handleError({
			kind: 'framework',
			error: { status: 404, message: 'Not Found' },
			event
		});
		expect(result).toBeUndefined();
		expect(log).not.toHaveBeenCalled();
	});
});
