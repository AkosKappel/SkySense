<script lang="ts">
	import { Keyboard, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	// U-18: the shortcuts that exist, opened by `?` from the layout. The native dialog traps
	// focus, closes on Escape and returns focus where it was. Closing sets `open` at once, and the
	// close event, which can arrive after a quick `?` has opened the dialog again, is ignored then.
	let { open = $bindable() }: { open: boolean } = $props();
	let dialog: HTMLDialogElement;
	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	const shortcuts = $derived([
		[['/', 'Ctrl K'], m.shortcut_search()],
		[['← ↑ → ↓', '+ −'], m.shortcut_map()],
		[['Esc'], m.shortcut_close()],
		[['?'], m.shortcut_help()]
	] as const);
</script>

<dialog
	bind:this={dialog}
	oncancel={() => (open = false)}
	onclose={() => {
		if (!dialog.open) open = false;
	}}
	onclick={(event) => event.target === dialog && (open = false)}
	aria-labelledby="shortcuts-title"
	class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-tile bg-surface p-6 text-ink shadow-2xl outline-1 outline-veil/15 backdrop:bg-black/50"
>
	<div class="flex items-center justify-between gap-4">
		<h2 id="shortcuts-title" class="question">
			<Keyboard size={18} aria-hidden="true" />
			{m.shortcuts_title()}
		</h2>
		<button
			type="button"
			class="icon-button"
			aria-label={m.close()}
			title={m.close()}
			onclick={() => (open = false)}
		>
			<X size={20} aria-hidden="true" />
		</button>
	</div>
	<dl class="mt-4 space-y-3">
		{#each shortcuts as [keys, label] (label)}
			<div class="flex items-center justify-between gap-4">
				<dt class="flex flex-wrap gap-1">
					{#each keys as key (key)}
						<kbd
							class="rounded-md bg-veil/10 px-2 py-0.5 font-sans text-sm font-semibold outline-1 outline-veil/20"
						>
							{key}
						</kbd>
					{/each}
				</dt>
				<dd class="text-right text-sm text-ink-muted">{label}</dd>
			</div>
		{/each}
	</dl>
</dialog>
