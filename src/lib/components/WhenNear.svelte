<script lang="ts">
	import type { Snippet } from 'svelte';

	// Renders its content once the spot comes within a screen or so of the viewport. For tiles far
	// down the page that fetch their own data: their code and requests wait until someone scrolls
	// towards them, which keeps the place page inside its script budget.
	let { children }: { children: Snippet } = $props();

	let near = $state(false);
	let marker = $state<HTMLElement>();

	$effect(() => {
		if (!marker) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) near = true;
			},
			{ rootMargin: '800px 0px' }
		);
		observer.observe(marker);
		return () => observer.disconnect();
	});
</script>

{#if near}
	{@render children()}
{:else}
	<div bind:this={marker} aria-hidden="true"></div>
{/if}
