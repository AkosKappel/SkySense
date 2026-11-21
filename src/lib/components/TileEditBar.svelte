<script lang="ts">
	import { Check, Eye, RotateCcw } from '@lucide/svelte';
	import { tileName } from '#lib/components/tile-names.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Tile, TileId } from '#lib/tiles.js';

	// Pinned to the bottom of the screen in the edit mode, kept small: the hidden tiles to bring
	// back in one scrolling row, a reset and Done. The help sits above the tiles, not pinned.
	let {
		tiles,
		onshow,
		onreset,
		ondone
	}: {
		tiles: Tile[];
		onshow: (id: TileId) => void;
		onreset: () => void;
		ondone: () => void;
	} = $props();

	const hidden = $derived(tiles.filter((t) => t.hidden));
</script>

<div
	class="sticky bottom-4 z-20 mt-4 glass bg-surface/90 p-4 shadow-xl print:hidden"
	role="region"
	aria-label={m.tiles_arrange()}
>
	{#if hidden.length}
		<ul class="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={m.tiles_hidden()}>
			{#each hidden as tile (tile.id)}
				<li>
					<button
						type="button"
						class="flex min-h-11 pill cursor-pointer items-center gap-1.5 px-4 text-sm font-semibold whitespace-nowrap"
						aria-label={m.tile_show({ tile: tileName(tile.id) })}
						onclick={() => onshow(tile.id)}
					>
						<Eye size={16} aria-hidden="true" />
						{tileName(tile.id)}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="flex flex-wrap items-center justify-between gap-2">
		<button
			type="button"
			class="flex min-h-11 cursor-pointer items-center gap-1.5 px-2 text-sm font-semibold underline-offset-4 hover:underline"
			onclick={onreset}
		>
			<RotateCcw size={16} aria-hidden="true" />
			{m.tiles_reset()}
		</button>
		<button
			type="button"
			class="flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-veil px-5 font-bold text-on-veil"
			onclick={ondone}
		>
			<Check size={18} aria-hidden="true" />
			{m.tiles_done()}
		</button>
	</div>
</div>
