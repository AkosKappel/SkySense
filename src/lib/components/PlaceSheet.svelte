<script lang="ts">
	import { MapPin, X } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PlaceSearch from '#lib/components/PlaceSearch.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { savedPlaces } from '#lib/places.svelte.js';
	import { formatCoordinates, type Coordinates } from '#lib/weather.js';

	// Open state lives in shallow-routed history (`page.state.placeSheet`), so Back closes the
	// sheet on every platform. The native dialog traps focus and returns it on close.
	let { current }: { current: Coordinates } = $props();

	let dialog: HTMLDialogElement;
	const open = $derived(Boolean(page.state.placeSheet));

	$effect(() => {
		if (open && !dialog.open) {
			dialog.showModal();
			if (page.state.placeSheet === 'search') document.getElementById('place-search')?.focus();
		}
		if (!open && dialog.open) dialog.close();
	});

	// Escape, the close button and a backdrop tap all end here; step back out of the sheet entry.
	function onclose() {
		if (page.state.placeSheet) history.back();
	}
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(event) => event.target === dialog && dialog.close()}
	aria-labelledby="place-sheet-title"
	class="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-tile bg-indigo-950 text-ink shadow-2xl outline-1 outline-white/15 backdrop:bg-black/50 md:mx-auto md:mb-auto md:max-w-lg md:rounded-tile"
>
	{#if open}
		<div class="p-6">
			<div class="flex items-center justify-between gap-4">
				<h2 id="place-sheet-title" class="answer">{m.change_place()}</h2>
				<button
					type="button"
					class="icon-button"
					aria-label={m.close()}
					onclick={() => dialog.close()}><X size={20} aria-hidden="true" /></button
				>
			</div>

			<div class="mt-4"><PlaceSearch replace /></div>

			{#if savedPlaces.list.length}
				<h3 class="mt-4 question">{m.saved_places()}</h3>
				<ul class="mt-3 space-y-2">
					{#each savedPlaces.list as place (formatCoordinates(place))}
						{@const here = formatCoordinates(place) === formatCoordinates(current)}
						<li>
							<a
								href={resolve('/p/[coords]/[[name]]', {
									coords: formatCoordinates(place),
									name: encodeURIComponent(place.name)
								})}
								data-sveltekit-replacestate
								aria-current={here ? 'page' : undefined}
								class="flex min-h-14 items-center gap-3 rounded-2xl px-4 outline-1 outline-white/10 {here
									? 'bg-white/15'
									: 'bg-white/5 hover:bg-white/10'}"
							>
								<MapPin size={18} class="shrink-0 text-ink-muted" aria-hidden="true" />
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{place.name}</span>
									{#if place.detail}<span class="block truncate text-sm text-ink-muted"
											>{place.detail}</span
										>{/if}
								</span>
								{#if here}<span class="text-sm text-ink-muted">{m.current_place()}</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</dialog>
