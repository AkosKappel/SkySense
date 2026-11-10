<script lang="ts">
	import { tick } from 'svelte';
	import { ArrowDown, ArrowUp, CloudSun, MapPin, Pencil, Settings, X } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import PlaceSearch from '#lib/components/PlaceSearch.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { savedPlaces, type SavedPlace } from '#lib/places.svelte.js';
	import { formatCoordinates } from '#lib/weather.js';

	let removed = $state<{ place: SavedPlace; index: number } | null>(null);
	let renaming = $state(-1);

	function finishRename(event: Event & { currentTarget: HTMLInputElement }, index: number) {
		if (renaming !== index) return;
		savedPlaces.rename(index, event.currentTarget.value);
		renaming = -1;
	}

	/** After Enter or Escape, focus goes back to the Rename button instead of the page. */
	async function refocusRename(index: number) {
		await tick();
		document.getElementById(`rename-${index}`)?.focus();
	}

	function remove(index: number) {
		const place = savedPlaces.remove(index);
		if (place) removed = { place, index };
	}

	function undo() {
		if (!removed) return;
		savedPlaces.insert(removed.index, removed.place);
		removed = null;
	}
</script>

<svelte:head>
	<title>SkySense</title>
	<meta name="description" content={m.tagline()} />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-4">
	<header class="flex items-center justify-between">
		<span class="flex items-center gap-2 text-lg font-bold">
			<CloudSun size={24} class="text-sun" aria-hidden="true" /> SkySense
		</span>
		<a
			href={resolve('/settings')}
			aria-label={m.settings()}
			class="grid size-11 pill place-items-center"
		>
			<Settings size={18} aria-hidden="true" />
		</a>
	</header>

	<section class="mt-8 glass p-6">
		<h1 class="answer">{m.home_question()}</h1>
		<p class="mt-2 text-ink-muted">{m.tagline()}</p>
		<div class="mt-6"><PlaceSearch /></div>
	</section>

	{#if savedPlaces.list.length}
		<section class="mt-4 glass p-6">
			<h2 class="question">{m.saved_places()}</h2>
			<ul class="mt-3 space-y-2">
				{#each savedPlaces.list as place, i (formatCoordinates(place))}
					<li class="flex items-center gap-1 rounded-2xl bg-white/5 outline-1 outline-white/10">
						{#if renaming === i}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								aria-label={m.place_name()}
								value={place.name}
								maxlength="80"
								autofocus
								class="mx-2 h-11 min-w-0 flex-1 rounded-xl bg-white/10 px-3 font-semibold outline-1 outline-white/30"
								onblur={(event) => finishRename(event, i)}
								onkeydown={(event) => {
									if (event.key !== 'Enter' && event.key !== 'Escape') return;
									// Without this, the Enter would also press the Rename button focused next.
									event.preventDefault();
									if (event.key === 'Enter') finishRename(event, i);
									else renaming = -1;
									refocusRename(i);
								}}
							/>
						{:else}
							<a
								href={resolve('/p/[coords]/[[name]]', {
									coords: formatCoordinates(place),
									name: encodeURIComponent(place.name)
								})}
								class="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4"
							>
								<MapPin size={18} class="shrink-0 text-ink-muted" aria-hidden="true" />
								<span class="min-w-0">
									<span class="block truncate font-semibold">{place.name}</span>
									{#if place.detail}<span class="block truncate text-sm text-ink-muted"
											>{place.detail}</span
										>{/if}
								</span>
							</a>
						{/if}
						<button
							type="button"
							id="rename-{i}"
							class="icon-button"
							aria-label={m.rename_place({ name: place.name })}
							onclick={() => (renaming = i)}><Pencil size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							class="icon-button"
							aria-label={m.move_up({ name: place.name })}
							disabled={i === 0}
							onclick={() => savedPlaces.move(i, -1)}
							><ArrowUp size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							class="icon-button"
							aria-label={m.move_down({ name: place.name })}
							disabled={i === savedPlaces.list.length - 1}
							onclick={() => savedPlaces.move(i, 1)}
							><ArrowDown size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							class="mr-1 icon-button"
							aria-label={m.remove_place({ name: place.name })}
							onclick={() => remove(i)}><X size={18} aria-hidden="true" /></button
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="min-h-6" role="status">
		{#if removed}
			<p class="mt-4 flex items-center justify-between gap-4 glass px-5 py-3">
				{m.place_removed({ name: removed.place.name })}
				<button type="button" class="min-h-11 cursor-pointer font-bold underline" onclick={undo}
					>{m.undo()}</button
				>
			</p>
		{/if}
	</div>

	<SiteFooter />
</main>
