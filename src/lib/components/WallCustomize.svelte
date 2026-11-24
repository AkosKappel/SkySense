<script lang="ts">
	import { ChevronDown, SlidersHorizontal, X } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { savedPlaces } from '#lib/places.svelte.js';
	import {
		nightModes,
		otherValue,
		wallBlocks,
		wallPresets,
		wallQuery,
		wallSizes,
		type WallBlock,
		type WallLayout
	} from '#lib/wall.js';

	// The wall's settings (F-31): a plain GET form, so the choice lands in the address, where a
	// bookmark keeps it. The button shows for a few seconds after a touch or a mouse move, like a
	// video player's controls, and stays while it has the keyboard focus.
	let { layout }: { layout: WallLayout } = $props();

	const SHOW_FOR_MS = 5000;
	let dialog = $state<HTMLDialogElement>();
	let awake = $state(false);

	$effect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const wake = () => {
			awake = true;
			clearTimeout(timer);
			timer = setTimeout(() => (awake = false), SHOW_FOR_MS);
		};
		addEventListener('pointermove', wake);
		addEventListener('pointerdown', wake);
		return () => {
			clearTimeout(timer);
			removeEventListener('pointermove', wake);
			removeEventListener('pointerdown', wake);
		};
	});

	const blockNames: Record<WallBlock, () => string> = {
		clock: m.wall_block_clock,
		date: m.wall_block_date,
		now: m.now,
		rain: m.wall_block_rain,
		sentence: m.wall_block_sentence,
		umbrella: m.wall_block_umbrella,
		wear: m.wall_block_wear,
		commute: m.wall_block_commute,
		readings: m.wall_block_readings,
		hours: m.next_12_hours,
		tomorrow: m.wall_block_tomorrow
	};
	const presets = [
		['clock', m.wall_preset_clock],
		['forecast', m.wall_preset_forecast],
		['everything', m.wall_preset_everything],
		['standard', m.wall_preset_standard]
	] as const;
	const sizeNames = { s: m.wall_size_s, m: m.wall_size_m, l: m.wall_size_l };
	const nightNames = { dim: m.wall_night_dim, clock: m.wall_night_clock, dark: m.wall_night_dark };
	// The second place comes from the saved places, which only this browser knows; one already in
	// the address stays choosable even when it is not saved here.
	const others = $derived.by(() => {
		const here = page.params.coords;
		const saved = savedPlaces.list
			.filter((p) => otherValue({ coordinates: p, name: p.name }).split('/')[0] !== here)
			.map((p) => ({ value: otherValue({ coordinates: p, name: p.name }), name: p.name }));
		const current = layout.also && otherValue(layout.also);
		return current && !saved.some((o) => o.value === current)
			? [{ value: current, name: layout.also!.name }, ...saved]
			: saved;
	});
	const wall = $derived(
		resolve('/wall/[coords]/[[name]]', {
			coords: page.params.coords ?? '',
			name: encodeURIComponent(page.params.name ?? '')
		})
	);
</script>

<button
	type="button"
	class={[
		'fixed right-4 bottom-4 icon-button pill transition-opacity duration-500 focus-visible:opacity-100 print:hidden',
		awake ? 'opacity-100' : 'opacity-0'
	]}
	aria-label={m.wall_customize()}
	title={m.wall_customize()}
	onclick={() => dialog?.showModal()}
>
	<SlidersHorizontal size={20} aria-hidden="true" />
</button>

<dialog
	bind:this={dialog}
	aria-labelledby="wall-customize"
	class="m-auto max-h-[90dvh] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-tile bg-surface p-6 text-ink backdrop:bg-black/50"
	closedby="any"
>
	<div class="flex items-center justify-between gap-4">
		<h2 id="wall-customize" class="text-xl font-bold">{m.wall_customize()}</h2>
		<button
			type="button"
			class="icon-button"
			aria-label={m.close()}
			title={m.close()}
			onclick={() => dialog?.close()}
		>
			<X size={20} aria-hidden="true" />
		</button>
	</div>

	<p class="mt-4 text-sm font-semibold">{m.wall_presets()}</p>
	<ul class="mt-2 flex flex-wrap gap-2">
		{#each presets as [id, label] (id)}
			<li>
				<a
					href="{resolve('/wall/[coords]/[[name]]', {
						coords: page.params.coords ?? '',
						name: encodeURIComponent(page.params.name ?? '')
					})}{wallQuery({ ...layout, blocks: [...wallPresets[id]] })}"
					data-sveltekit-replacestate
					class="flex min-h-11 items-center rounded-full bg-veil/10 px-4 font-semibold outline-1 outline-veil/20 hover:bg-veil/20"
					onclick={() => dialog?.close()}
				>
					{label()}
				</a>
			</li>
		{/each}
	</ul>

	<form method="GET" action={wall} data-sveltekit-replacestate class="mt-6 space-y-6">
		<fieldset>
			<legend class="text-sm font-semibold">{m.wall_blocks()}</legend>
			<div class="mt-2 grid gap-1 sm:grid-cols-2">
				{#each wallBlocks as block (block)}
					<label class="flex min-h-11 cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							name="show"
							value={block}
							checked={layout.blocks.includes(block)}
							class="size-5 accent-current"
						/>
						{blockNames[block]()}
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend class="text-sm font-semibold">{m.wall_size()}</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each wallSizes as size (size)}
					<label
						class="flex min-h-11 cursor-pointer items-center rounded-full bg-veil/10 px-4 font-semibold outline-1 outline-veil/20 has-checked:bg-veil has-checked:text-on-veil has-focus-visible:outline-2 has-focus-visible:outline-veil"
					>
						<input
							type="radio"
							name="size"
							value={size}
							checked={layout.size === size}
							class="sr-only"
						/>
						{sizeNames[size]()}
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend class="text-sm font-semibold">{m.wall_night()}</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each nightModes as mode (mode)}
					<label
						class="flex min-h-11 cursor-pointer items-center rounded-full bg-veil/10 px-4 font-semibold outline-1 outline-veil/20 has-checked:bg-veil has-checked:text-on-veil has-focus-visible:outline-2 has-focus-visible:outline-veil"
					>
						<input
							type="radio"
							name="night"
							value={mode}
							checked={layout.night === mode}
							class="sr-only"
						/>
						{nightNames[mode]()}
					</label>
				{/each}
			</div>
		</fieldset>

		<div>
			<label for="wall-also" class="text-sm font-semibold">{m.wall_also()}</label>
			<div class="relative mt-2">
				<select
					id="wall-also"
					name="also"
					aria-describedby="wall-also-note"
					class="h-12 w-full cursor-pointer appearance-none rounded-2xl bg-veil/10 pr-12 pl-4 text-ink outline-1 outline-veil/20"
				>
					<option value="">{m.wall_also_none()}</option>
					{#each others as other (other.value)}
						<option
							value={other.value}
							selected={layout.also !== null && otherValue(layout.also) === other.value}
						>
							{other.name}
						</option>
					{/each}
				</select>
				<ChevronDown
					size={18}
					class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted"
					aria-hidden="true"
				/>
			</div>
			<p id="wall-also-note" class="mt-2 text-sm text-ink-muted">{m.wall_also_note()}</p>
		</div>

		<p class="text-sm text-ink-muted">{m.wall_customize_note()}</p>
		<button
			type="submit"
			class="h-12 w-full cursor-pointer rounded-full bg-veil font-bold text-on-veil transition hover:bg-veil/90"
			onclick={() => dialog?.close()}
		>
			{m.save()}
		</button>
	</form>
</dialog>
