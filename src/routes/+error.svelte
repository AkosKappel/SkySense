<script lang="ts">
	import { CloudOff, MapPinOff } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const notFound = $derived(page.status === 404);
	const service = $derived(page.status === 502 || page.status === 503);
</script>

<svelte:head>
	<title>SkySense</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-16">
	<section class="glass p-8">
		{#if notFound}
			<MapPinOff size={40} class="text-sun" aria-hidden="true" />
			<h1 class="mt-4 answer">{m.error_not_found_title()}</h1>
			<p class="mt-2 text-ink-muted">{m.error_not_found_body()}</p>
		{:else if service}
			<CloudOff size={40} class="text-rain" aria-hidden="true" />
			<h1 class="mt-4 answer">{m.error_service_title()}</h1>
			<p class="mt-2 text-ink-muted">{m.error_service_body()}</p>
		{:else}
			<CloudOff size={40} class="text-rain" aria-hidden="true" />
			<h1 class="mt-4 answer">{m.error_generic_title()}</h1>
		{/if}
		{#if page.error?.id}
			<p class="mt-3 text-sm text-ink-muted">{m.error_reference({ id: page.error.id })}</p>
		{/if}
		<div class="mt-6 flex flex-wrap gap-3">
			{#if !notFound}
				<button
					type="button"
					onclick={() => location.reload()}
					class="flex h-12 cursor-pointer items-center rounded-full bg-white px-5 font-bold text-indigo-950"
					>{m.try_again()}</button
				>
			{/if}
			<a href="{resolve('/')}?choose" class="flex h-12 pill items-center px-5 font-semibold"
				>{m.search_again()}</a
			>
		</div>
	</section>
	<SiteFooter />
</main>
