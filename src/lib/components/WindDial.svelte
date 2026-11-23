<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// A compass with an arrow along the way the wind blows: it comes from `from` degrees
	// (meteorological, 0 is north). Decorative: the tile names the direction in words.
	let { from }: { from: number } = $props();
</script>

<svg viewBox="0 0 64 64" class="size-16 shrink-0 text-ink" aria-hidden="true">
	<circle cx="32" cy="32" r="27" fill="none" class="stroke-veil/20" stroke-width="2" />
	{#each [0, 45, 90, 135, 180, 225, 270, 315] as angle (angle)}
		<line
			x1="32"
			y1="7"
			x2="32"
			y2={angle % 90 ? 9 : 11}
			class="stroke-veil/40"
			stroke-width="2"
			transform="rotate({angle} 32 32)"
		/>
	{/each}
	<text x="32" y="19" text-anchor="middle" class="fill-ink-muted text-[9px] font-bold">
		{m.compass_north()}
	</text>
	<g class="dial-arrow" style:rotate="{from + 180}deg" style:transform-origin="32px 32px">
		<line
			x1="32"
			y1="42"
			x2="32"
			y2="28"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<path d="M27 30 L32 22 L37 30 Z" fill="currentColor" />
	</g>
</svg>
