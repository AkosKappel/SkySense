<script lang="ts">
	import { Scale } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { pageName, placeKey, savedPlaces } from '#lib/places.svelte.js';
	import { formatCoordinates, type Coordinates } from '#lib/weather.js';

	// "Compare with" another saved place (X-07). Saved places live in this browser, so this only
	// appears once the page runs and there is another place to pick. A GET form to /compare.
	let { current }: { current: Coordinates & { name: string } } = $props();

	const others = $derived(
		savedPlaces.list.filter((p) => formatCoordinates(p) !== formatCoordinates(current))
	);
	let chosen = $state(0);
	const other = $derived(others[chosen] ?? others[0]);
</script>

{#if other}
	<form
		action={resolve('/compare')}
		method="get"
		class="mt-4 flex flex-wrap items-end gap-2 border-t border-white/10 pt-4"
	>
		<input type="hidden" name="a" value={formatCoordinates(current)} />
		<input type="hidden" name="an" value={current.name} />
		<input type="hidden" name="b" value={formatCoordinates(other)} />
		<input type="hidden" name="bn" value={pageName(other)} />
		<label class="flex min-w-0 flex-1 flex-col gap-1 text-sm text-ink-muted">
			{m.compare_with()}
			<select
				bind:value={chosen}
				class="h-11 min-w-0 rounded-xl bg-white/10 px-3 text-ink outline-1 outline-white/20"
			>
				{#each others as place, i (placeKey(place))}
					<option value={i} class="text-slate-900"
						>{place.live ? m.my_location() : place.name}</option
					>
				{/each}
			</select>
		</label>
		<button
			type="submit"
			class="flex h-11 pill cursor-pointer items-center gap-2 px-4 text-sm font-semibold"
		>
			<Scale size={16} aria-hidden="true" />
			{m.compare_button()}
		</button>
	</form>
{/if}
