<script lang="ts">
	import { Share2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { title }: { title: string } = $props();

	let message = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	function say(text: string) {
		message = text;
		clearTimeout(timer);
		timer = setTimeout(() => (message = ''), 4000);
	}

	async function share() {
		const url = location.href;
		if (navigator.share) {
			try {
				await navigator.share({ title, url });
			} catch {
				// Closing the share sheet rejects too; there is nothing to report.
			}
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			say(m.link_copied());
		} catch {
			say(m.copy_failed());
		}
	}
</script>

<button
	type="button"
	class="grid size-11 pill place-items-center"
	aria-label={m.share()}
	onclick={share}
>
	<Share2 size={18} aria-hidden="true" />
</button>
<p
	class="pointer-events-none fixed inset-x-4 bottom-6 z-20 mx-auto max-w-sm text-center"
	aria-live="polite"
>
	{#if message}<span class="inline-block glass px-5 py-3 font-semibold">{message}</span>{/if}
</p>
