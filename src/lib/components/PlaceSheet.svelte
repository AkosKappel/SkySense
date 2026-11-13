<script lang="ts">
	import { LocateFixed, MapPin, X } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PlaceSearch from '#lib/components/PlaceSearch.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { openLive } from '#lib/open-live.js';
	import { pageName, placeKey, savedPlaces } from '#lib/places.svelte.js';
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

	// Escape, the close button and a backdrop tap only step back; the effect above closes the
	// dialog once history has moved, so a quick reopen cannot be undone by a late Back.
	const dismiss = () => history.back();

	// A close that did not come through history (the browser can refuse to cancel a repeated
	// Escape) still leaves the sheet entry; the close event fires a task later, so a sheet opened
	// again in between is left alone.
	function onclose() {
		if (page.state.placeSheet && !dialog.open) history.back();
	}
</script>

<dialog
	bind:this={dialog}
	{onclose}
	oncancel={(event) => {
		event.preventDefault();
		dismiss();
	}}
	onclick={(event) => event.target === dialog && dismiss()}
	aria-labelledby="place-sheet-title"
	class="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-tile bg-surface text-ink shadow-2xl outline-1 outline-veil/15 backdrop:bg-black/50 md:mx-auto md:mb-auto md:max-w-lg md:rounded-tile"
>
	{#if open}
		<div class="p-6">
			<div class="flex items-center justify-between gap-4">
				<h2 id="place-sheet-title" class="answer">{m.change_place()}</h2>
				<button type="button" class="icon-button" aria-label={m.close()} onclick={dismiss}
					><X size={20} aria-hidden="true" /></button
				>
			</div>

			<div class="mt-4"><PlaceSearch replace floating={false} /></div>

			{#if savedPlaces.list.length}
				<h3 class="mt-4 question">{m.saved_places()}</h3>
				<ul class="mt-3 space-y-2">
					{#each savedPlaces.list as place (placeKey(place))}
						{@const here = formatCoordinates(place) === formatCoordinates(current)}
						<li>
							<a
								href={resolve('/p/[coords]/[[name]]', {
									coords: formatCoordinates(place),
									name: encodeURIComponent(pageName(place))
								})}
								onclick={(event) => place.live && openLive(event, place, m.my_location(), true)}
								data-sveltekit-replacestate
								aria-current={here ? 'page' : undefined}
								class="flex min-h-14 items-center gap-3 rounded-2xl px-4 outline-1 outline-veil/10 {here
									? 'bg-veil/15'
									: 'bg-veil/5 hover:bg-veil/10'}"
							>
								{#if place.live}<LocateFixed
										size={18}
										class="shrink-0 text-ink-muted"
										aria-hidden="true"
									/>{:else}<MapPin
										size={18}
										class="shrink-0 text-ink-muted"
										aria-hidden="true"
									/>{/if}
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold"
										>{place.live ? m.my_location() : place.name}</span
									>
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
