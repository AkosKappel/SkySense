import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemo, memo } from './memo.js';

describe('memo', () => {
	beforeEach(() => {
		clearMemo();
		vi.useRealTimers();
	});

	it('answers repeats from memory until the entry expires', async () => {
		vi.useFakeTimers();
		const load = vi.fn(async () => 'forecast');
		await memo('a', 1000, load);
		await memo('a', 1000, load);
		expect(load).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(1001);
		await memo('a', 1000, load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('does not keep failures', async () => {
		const load = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok');
		await expect(memo('b', 1000, load)).rejects.toThrow('down');
		await expect(memo('b', 1000, load)).resolves.toBe('ok');
	});
});
