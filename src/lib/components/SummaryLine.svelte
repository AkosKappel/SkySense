<script lang="ts">
	import type { Formatter } from '#lib/format.js';
	import type { Sentence } from '#lib/summary.js';
	import { summaryText } from './summary-text.js';

	let { sentences, f }: { sentences: Sentence[]; f: Formatter } = $props();

	const text = $derived(summaryText(sentences, f));
</script>

<p class="text-xl leading-snug font-semibold text-balance md:text-2xl">
	{text}
</p>
