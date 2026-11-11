<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.privacy()} · SkySense</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-4">
	<header class="flex items-center gap-3">
		<a href={resolve('/')} aria-label={m.back()} class="grid size-11 pill place-items-center">
			<ArrowLeft size={18} aria-hidden="true" />
		</a>
		<h1 class="text-2xl font-extrabold">{m.privacy()}</h1>
	</header>

	<article class="mt-6 space-y-4 glass p-6 leading-relaxed">
		<p class="answer">{m.privacy_summary()}</p>
		<p>{m.privacy_location()}</p>
		<p>{m.privacy_radar()}</p>
		<p>{m.privacy_device()}</p>
		<p>{m.privacy_hosting()}</p>
	</article>

	<SiteFooter />
</main>
