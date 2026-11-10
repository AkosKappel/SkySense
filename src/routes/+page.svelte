<script lang="ts">
	import { CloudSun } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>SkySense</title>
	<meta name="description" content={m.tagline()} />
</svelte:head>

<main class="grid min-h-dvh place-items-center p-4">
	<section class="w-full max-w-md glass p-8 text-center">
		<CloudSun size={72} strokeWidth={1.25} class="mx-auto text-sun" aria-hidden="true" />
		<h1 class="mt-4 text-5xl font-extrabold tracking-tight">SkySense</h1>
		<p class="mt-3 answer">{m.tagline()}</p>
	</section>
</main>
