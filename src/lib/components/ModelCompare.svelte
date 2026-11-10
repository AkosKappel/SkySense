<script lang="ts">
	import { ArrowLeft, Scale } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Formatter } from '#lib/format.js';
	import { rainTotal, widestGap, type ModelId, type ModelRun } from '#lib/models.js';
	import { m } from '#lib/paraglide/messages.js';

	let { runs, from, f }: { runs: ModelRun[] | null; from: string; f: Formatter } = $props();

	// Names of the centres' models, the same in every language.
	const models: Record<ModelId, { name: string; stroke: string; swatch: string; dash: string }> = {
		ecmwf_ifs025: { name: 'ECMWF', stroke: 'stroke-sun', swatch: 'bg-sun', dash: '' },
		gfs_seamless: { name: 'GFS', stroke: 'stroke-rain', swatch: 'bg-rain', dash: '6 3' },
		icon_seamless: { name: 'ICON', stroke: 'stroke-good', swatch: 'bg-good', dash: '2 3' },
		meteofrance_seamless: {
			name: 'Météo-France',
			stroke: 'stroke-rose',
			swatch: 'bg-rose',
			dash: '10 3 2 3'
		},
		ukmo_seamless: { name: 'Met Office', stroke: 'stroke-ink', swatch: 'bg-ink', dash: '1 5' }
	};

	const HOURS = 72;
	const STEP = 10;
	const HEIGHT = 100;
	const shown = $derived(
		(runs ?? []).map((r) => ({
			...r,
			hours: r.hours.filter((h) => h.time >= from).slice(0, HOURS)
		}))
	);
	const times = $derived(shown[0]?.hours.map((h) => h.time) ?? []);
	const temps = $derived(shown.flatMap((r) => r.hours.map((h) => h.temp)));
	const low = $derived(Math.min(...temps) - 1);
	const high = $derived(Math.max(...temps) + 1);
	const y = (temp: number) => 5 + (1 - (temp - low) / (high - low)) * 90;
	const line = (run: ModelRun) =>
		run.hours.map((h, i) => `${i ? 'L' : 'M'}${i * STEP},${y(h.temp).toFixed(1)}`).join('');
	const gap = $derived(runs ? widestGap(runs, from, 24) : null);
	const rows = $derived(times.filter((_, i) => i % 3 === 0));
</script>

<div class="mt-5 flex items-center gap-3">
	<a
		href={resolve('/p/[coords]/[[name]]', {
			coords: page.params.coords ?? '',
			name: encodeURIComponent(page.params.name ?? '')
		})}
		aria-label={m.back_to_forecast()}
		class="grid size-11 shrink-0 pill place-items-center"
	>
		<ArrowLeft size={18} aria-hidden="true" />
	</a>
	<h1 class="text-2xl font-extrabold">{m.compare_models()}</h1>
</div>
<p class="mt-3 max-w-2xl px-1 text-ink-muted">{m.compare_intro()}</p>

{#if !shown.length}
	<p class="mt-4 glass p-6">{m.models_unavailable()}</p>
{:else}
	<div class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3 [&>*]:min-w-0">
		<section class="glass p-6 md:col-span-2">
			<p class="question"><Scale size={18} aria-hidden="true" /> {m.models_question()}</p>
			{#if gap}
				<p class="mt-2 answer">
					{m.models_gap({ gap: f.tempDelta(gap.gap), time: f.time(gap.time) })}
				</p>
			{/if}
			<svg
				viewBox="0 0 {(times.length - 1) * STEP} {HEIGHT}"
				preserveAspectRatio="none"
				class="mt-4 h-48 w-full overflow-visible"
				aria-hidden="true"
			>
				{#each shown as run (run.id)}
					<path
						d={line(run)}
						class="fill-none {models[run.id].stroke} forced-colors:stroke-[CanvasText]"
						stroke-width="2"
						stroke-dasharray={models[run.id].dash || undefined}
						stroke-linejoin="round"
						vector-effect="non-scaling-stroke"
					/>
				{/each}
			</svg>
			<div class="mt-1 flex justify-between text-xs text-ink-muted tabular-nums" aria-hidden="true">
				{#each times.filter((_, i) => i % 12 === 0) as time (time)}
					<span>{f.hour(time)}</span>
				{/each}
			</div>
			<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
				{#each shown as run (run.id)}
					<li class="flex items-center gap-1.5">
						<svg viewBox="0 0 20 4" class="h-1 w-5 overflow-visible">
							<line
								x1="0"
								y1="2"
								x2="20"
								y2="2"
								class="{models[run.id].stroke} forced-colors:stroke-[CanvasText]"
								stroke-width="3"
								stroke-dasharray={models[run.id].dash || undefined}
							/>
						</svg>
						{models[run.id].name}
					</li>
				{/each}
			</ul>
			<details class="mt-3">
				<summary class="min-h-11 cursor-pointer content-center text-sm font-semibold"
					>{m.show_table()}</summary
				>
				<div class="max-h-72 overflow-auto">
					<table class="w-full text-sm tabular-nums [&_td]:pr-3 [&_th]:pr-3">
						<thead class="text-left text-ink-muted">
							<tr>
								<th scope="col" class="py-1 font-medium">{m.hour()}</th>
								{#each shown as run (run.id)}
									<th scope="col" class="py-1 font-medium">{models[run.id].name}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each rows as time (time)}
								<tr class="border-t border-white/10">
									<th scope="row" class="py-1 text-left font-medium whitespace-nowrap">
										{f.weekday(time.slice(0, 10))}
										{f.time(time)}
									</th>
									{#each shown as run (run.id)}
										{@const hour = run.hours.find((h) => h.time === time)}
										<td>{hour ? f.temp(hour.temp) : '–'}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		</section>

		<section class="self-start glass p-6">
			<h2 class="question">{m.models_rain_question()}</h2>
			<dl class="mt-3 space-y-2">
				{#each shown as run (run.id)}
					<div class="flex items-center justify-between gap-3">
						<dt class="flex items-center gap-2">
							<span
								class="size-2.5 rounded-full {models[run.id]
									.swatch} forced-color-adjust-none forced-colors:bg-[CanvasText]"
								aria-hidden="true"
							></span>
							{models[run.id].name}
						</dt>
						<dd class="font-semibold tabular-nums">{f.rain(rainTotal(run, from, 24))}</dd>
					</div>
				{/each}
			</dl>
		</section>
	</div>
{/if}
