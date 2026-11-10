<script lang="ts">
	import { ImageDown } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { drawShareCard, type ShareCard } from '#lib/share-card.js';

	// Builds the picture only when asked; `card` is cheap, the canvas is not.
	let { card, filename }: { card: () => ShareCard; filename: string } = $props();

	let busy = $state(false);

	async function share() {
		busy = true;
		try {
			await document.fonts.ready;
			const canvas = document.createElement('canvas');
			drawShareCard(canvas, card());
			const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
			if (!blob) return;
			const file = new File([blob], filename, { type: 'image/png' });
			if (navigator.canShare?.({ files: [file] })) {
				try {
					await navigator.share({ files: [file] });
				} catch {
					// Closing the share sheet rejects too.
				}
				return;
			}
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			link.click();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		} finally {
			busy = false;
		}
	}
</script>

<button
	type="button"
	onclick={share}
	disabled={busy}
	class="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
>
	<ImageDown size={16} aria-hidden="true" />
	{m.share_today()}
</button>
