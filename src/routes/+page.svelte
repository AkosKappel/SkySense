<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>SkySense</title>
	<meta name="description" content={m.tagline()} />
</svelte:head>

<main class="grid min-h-dvh place-content-center gap-2 p-4 text-center">
	<h1 class="text-4xl font-semibold">SkySense</h1>
	<p>{m.tagline()}</p>
</main>
