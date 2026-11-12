<script lang="ts">
	import type { Formatter } from '#lib/format.js';
	import type { Sentence } from '#lib/summary.js';
	import { summaryText } from './summary-text.js';

	// `large` sets the sentence as the page's headline on wide screens (the place page, the home
	// page's samples); the embed card keeps it small.
	let {
		sentences,
		f,
		large = false
	}: { sentences: Sentence[]; f: Formatter; large?: boolean } = $props();

	const text = $derived(summaryText(sentences, f));
</script>

<p
	class={[
		'text-xl leading-snug font-semibold text-balance md:text-2xl',
		large && 'lg:text-[2.75rem] lg:leading-[1.08] lg:font-extrabold lg:tracking-[-0.025em]'
	]}
>
	{text}
</p>
