<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.about()} · SkySense</title>
	<meta name="description" content={m.tagline()} />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-4">
	<header class="flex items-center gap-3">
		<a href={resolve('/')} aria-label={m.back()} class="grid size-11 pill place-items-center">
			<ArrowLeft size={18} aria-hidden="true" />
		</a>
		<h1 class="text-2xl font-extrabold">{m.about_title()}</h1>
	</header>

	<article class="mt-6 space-y-4 glass p-6 leading-relaxed">
		<p class="answer">{m.tagline()}</p>
		<p>{m.about_what()}</p>
		<p>{m.about_data()}</p>
		<p>{m.about_languages()}</p>
		<p>
			<a
				href="https://open-meteo.com/"
				class="font-semibold underline underline-offset-4"
				rel="noopener">{m.data_attribution()}</a
			>
			· CC BY 4.0
		</p>
	</article>

	<SiteFooter />
</main>
