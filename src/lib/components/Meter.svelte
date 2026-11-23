<script lang="ts">
	// A small scale under a reading (UV, humidity, pressure): a marker on a track, or a fill when
	// no bands are given. Decorative: the reading above it is the text equivalent.
	let {
		value,
		min,
		max,
		bands = []
	}: {
		value: number;
		min: number;
		max: number;
		/** Coloured stretches of the track as [up to, Tailwind background class], in order. */
		bands?: [number, string][];
	} = $props();

	const position = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
	const at = $derived(position(value));
</script>

<div class="relative mt-3 h-1.5 rounded-full bg-veil/10" aria-hidden="true">
	{#if bands.length}
		<div class="grow-x flex h-full overflow-hidden rounded-full">
			{#each bands as [upTo, color], i (i)}
				<span
					class="h-full {color}"
					style="width: {position(upTo) - (i ? position(bands[i - 1][0]) : 0)}%"
				></span>
			{/each}
		</div>
		<span
			class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink outline-2 outline-surface"
			style="left: {at}%"
		></span>
	{:else}
		<div class="grow-x h-full rounded-full bg-rain" style="width: {at}%"></div>
	{/if}
</div>
