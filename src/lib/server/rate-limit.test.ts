import { describe, expect, it } from 'vitest';
import { rateLimiter } from './rate-limit.js';

describe('rateLimiter', () => {
	it('allows up to the limit per window and key, then says when to retry', () => {
		const limit = rateLimiter(2, 60_000);
		expect(limit('a', 0).allowed).toBe(true);
		expect(limit('a', 1000).allowed).toBe(true);
		expect(limit('a', 2000)).toEqual({ allowed: false, retryAfter: 58 });
		expect(limit('b', 2000).allowed).toBe(true);
		expect(limit('a', 60_000).allowed).toBe(true);
	});

	it('forgets the oldest keys beyond its size', () => {
		const limit = rateLimiter(1, 60_000, 2);
		limit('a', 0);
		limit('b', 0);
		limit('c', 0);
		expect(limit('a', 1).allowed).toBe(true);
		expect(limit('c', 1).allowed).toBe(false);
	});
});
