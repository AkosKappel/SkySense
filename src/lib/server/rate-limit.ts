// Requests per client for the API routes (T-18). The routes forward to free services with daily
// quotas; the CDN answers repeats before they reach us, so what is counted here is real upstream
// work. Per serverless instance: a client spread over many instances gets a little more.

export type Limiter = (key: string, now?: number) => { allowed: boolean; retryAfter: number };

/** At most `limit` requests per `windowMs` for each key, in fixed windows. */
export function rateLimiter(limit: number, windowMs: number, maxKeys = 10_000): Limiter {
	const windows = new Map<string, { start: number; count: number }>();
	return (key, now = Date.now()) => {
		let entry = windows.get(key);
		if (!entry || now - entry.start >= windowMs) {
			entry = { start: now, count: 0 };
			windows.delete(key);
			windows.set(key, entry);
			// Maps keep insertion order, so the first key is the one seen longest ago.
			if (windows.size > maxKeys) windows.delete(windows.keys().next().value!);
		}
		entry.count++;
		const allowed = entry.count <= limit;
		return { allowed, retryAfter: allowed ? 0 : Math.ceil((entry.start + windowMs - now) / 1000) };
	};
}
