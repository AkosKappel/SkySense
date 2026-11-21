<script lang="ts">
	import type { Snippet } from 'svelte';

	// Renders its content once the spot comes within a screen or so of the viewport. For tiles far
	// down the page that fetch their own data: their code and requests wait until someone scrolls
	// towards them, which keeps the place page inside its script budget.
	let {
		children,
		margin = '800px'
	}: {
		children: Snippet;
		/** How far below the screen it starts loading; a heavy tile waits until it is on screen. */
		margin?: string;
	} = $props();

	let near = $state(false);
	let marker = $state<HTMLElement>();

	$effect(() => {
		if (!marker) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) near = true;
			},
			{ rootMargin: `${margin} 0px` }
		);
		observer.observe(marker);
		return () => observer.disconnect();
	});
</script>

{#if near}
	{@render children()}
{:else}
	<div bind:this={marker} aria-hidden="true" data-when-near></div>
{/if}
