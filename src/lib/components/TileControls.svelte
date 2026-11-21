<script lang="ts">
	import { ArrowDown, ArrowUp, EyeOff, GripVertical, Maximize2, Minimize2 } from '@lucide/svelte';
	import { tileName } from '#lib/components/tile-names.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Tile, TileId } from '#lib/tiles.js';

	// The bar over a tile in the edit mode (U-26, U-27). Dragging uses pointer events, so it works
	// with touch as well as a mouse; the arrow buttons do the same for keyboards and screen readers.
	let {
		tile,
		first,
		last,
		onstep,
		onmove,
		onchange
	}: {
		tile: Tile;
		first: boolean;
		last: boolean;
		onstep: (step: -1 | 1) => void;
		/** While dragging: the tile under the pointer, whose place this one takes. */
		onmove: (to: TileId) => void;
		onchange: (change: Partial<Omit<Tile, 'id'>>) => void;
	} = $props();

	const name = $derived(tileName(tile.id));
	let dragging = $state(false);
	// The tile last moved over, so one hover moves once, not on every pointer event.
	let lastOver: TileId | undefined;
	let pointer = { x: 0, y: 0 };
	/** Near the top or bottom of the screen, the page scrolls so a tile can go past tall ones. */
	const EDGE = 72;

	// On the window, not the handle: moving a tile re-inserts its element, which drops a pointer
	// capture, and the release would then go unseen.
	function track(event: PointerEvent) {
		pointer = { x: event.clientX, y: event.clientY };
		takePlace();
	}

	// Takes the place of the tile under the pointer: on every move, and each frame while the page
	// scrolls under a still pointer.
	function takePlace() {
		if (!dragging) return;
		const over = document
			.elementFromPoint(pointer.x, pointer.y)
			?.closest<HTMLElement>('[data-tile]')?.dataset.tile as TileId | undefined;
		if (over && over !== tile.id && over !== lastOver) {
			lastOver = over;
			onmove(over);
		}
	}

	function start(event: PointerEvent) {
		dragging = true;
		lastOver = undefined;
		track(event);
		addEventListener('pointermove', track);
		addEventListener('pointerup', stop);
		addEventListener('pointercancel', stop);
		requestAnimationFrame(follow);
	}

	function stop() {
		dragging = false;
		removeEventListener('pointermove', track);
		removeEventListener('pointerup', stop);
		removeEventListener('pointercancel', stop);
	}

	// Leaving the edit mode mid-drag ends the drag too.
	$effect(() => stop);

	// Each frame while dragging: scroll when the pointer is at an edge.
	function follow() {
		if (!dragging) return;
		const { y } = pointer;
		const step =
			y < EDGE ? -(EDGE - y) / 4 : y > innerHeight - EDGE ? (y - innerHeight + EDGE) / 4 : 0;
		if (step) {
			scrollBy(0, step);
			takePlace();
		}
		requestAnimationFrame(follow);
	}

	const button =
		'grid size-11 cursor-pointer place-items-center rounded-full transition hover:bg-veil/10 disabled:cursor-default disabled:opacity-30';
</script>

<div
	class="absolute inset-x-2 top-2 z-10 flex items-center gap-1 rounded-full bg-surface/95 px-1 shadow-lg outline-1 outline-veil/15"
>
	<button
		type="button"
		class="{button} cursor-grab touch-none active:cursor-grabbing"
		aria-label={m.tile_drag({ tile: name })}
		title={m.tile_drag({ tile: name })}
		onpointerdown={start}
	>
		<GripVertical size={18} aria-hidden="true" />
	</button>
	<span class="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{name}</span>
	<button
		type="button"
		class={button}
		aria-label={m.tile_up({ tile: name })}
		title={m.tile_up({ tile: name })}
		disabled={first}
		onclick={() => onstep(-1)}
	>
		<ArrowUp size={18} aria-hidden="true" />
	</button>
	<button
		type="button"
		class={button}
		aria-label={m.tile_down({ tile: name })}
		title={m.tile_down({ tile: name })}
		disabled={last}
		onclick={() => onstep(1)}
	>
		<ArrowDown size={18} aria-hidden="true" />
	</button>
	<!-- Width only matters on the two-column grid. -->
	<button
		type="button"
		class="{button} hidden md:grid"
		aria-label={tile.wide ? m.tile_narrow({ tile: name }) : m.tile_wide({ tile: name })}
		title={tile.wide ? m.tile_narrow({ tile: name }) : m.tile_wide({ tile: name })}
		onclick={() => onchange({ wide: !tile.wide })}
	>
		{#if tile.wide}<Minimize2 size={18} aria-hidden="true" />{:else}<Maximize2
				size={18}
				aria-hidden="true"
			/>{/if}
	</button>
	<button
		type="button"
		class={button}
		aria-label={m.tile_hide({ tile: name })}
		title={m.tile_hide({ tile: name })}
		onclick={() => onchange({ hidden: true })}
	>
		<EyeOff size={18} aria-hidden="true" />
	</button>
</div>
