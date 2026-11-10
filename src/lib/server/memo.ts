// A small per-instance cache for upstream answers (D-13, docs/decisions/0004). Server rendering
// calls the API routes in-process, past the CDN, so without it every first visit to a place
// reached Open-Meteo. A warm serverless instance now answers repeats from memory.

type Entry = { until: number; value: Promise<unknown> };

const MAX_ENTRIES = 500;
const entries = new Map<string, Entry>();

/** The cached promise for `key`, or a new one from `load`; failures are not kept. */
export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
	const now = Date.now();
	const hit = entries.get(key);
	if (hit && hit.until > now) return hit.value as Promise<T>;

	const value = load();
	entries.delete(key);
	entries.set(key, { until: now + ttlMs, value });
	value.catch(() => entries.delete(key));
	// Maps keep insertion order, so the first key is the oldest.
	if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
	return value;
}

export function clearMemo() {
	entries.clear();
}
