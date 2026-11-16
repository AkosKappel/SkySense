<script lang="ts">
	import { Download, Upload } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { exportPlaces, importPlaces } from '#lib/places-file.js';
	import { savedPlaces } from '#lib/places.svelte.js';

	let result = $state('');

	function download() {
		const file = new Blob([exportPlaces()], { type: 'application/json' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(file);
		link.download = 'skysense-places.json';
		link.click();
		// Revoked after the download has started; at once, some browsers cancel it.
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
	}

	async function load(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		let added = 0;
		try {
			added = importPlaces(JSON.parse(await file.text()));
		} catch {
			// Not JSON: reported like a file without new places.
		}
		result = added ? m.places_imported({ count: added }) : m.places_import_none();
	}

	const action =
		'flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline';
</script>

<div class="px-1">
	<p class="text-sm text-ink-muted">{m.places_backup_note()}</p>
	<div class="flex flex-wrap gap-x-5">
		{#if savedPlaces.list.some((p) => !p.live)}
			<button type="button" class={action} onclick={download}>
				<Download size={16} aria-hidden="true" />
				{m.places_export()}
			</button>
		{/if}
		<label class="relative {action} has-focus-visible:outline-2 has-focus-visible:outline-veil">
			<Upload size={16} aria-hidden="true" />
			{m.places_import()}
			<input type="file" accept="application/json,.json" class="sr-only" onchange={load} />
		</label>
	</div>
	<p class="text-sm font-semibold empty:hidden" role="status">{result}</p>
</div>
