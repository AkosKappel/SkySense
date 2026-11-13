<script lang="ts">
	import { ArrowLeft, Check, Scale } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import { compareDays } from '#lib/compare.js';
	import { formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatCoordinates, type Day } from '#lib/weather.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const f = $derived(formatter(getLocale(), data.units));
	const nameA = $derived(data.a.name ?? m.unnamed_place());
	const nameB = $derived(data.b.name ?? m.unnamed_place());
	const days = $derived(compareDays(data.forecastA, data.forecastB));
	const rated = $derived(days.filter((d) => d.rated).length);
	const winsA = $derived(days.filter((d) => d.better === 'a').length);
	const winsB = $derived(days.filter((d) => d.better === 'b').length);
	const answer = $derived(
		winsA === winsB
			? m.compare_even()
			: m.compare_answer({
					place: winsA > winsB ? nameA : nameB,
					days: Math.max(winsA, winsB),
					total: rated
				})
	);
	const title = $derived(m.compare_title_two({ a: nameA, b: nameB }));
</script>

<svelte:head>
	<title>{title} · SkySense</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet cell(day: Day, nicer: boolean)}
	<td class="py-2 pr-1.5 pl-1.5 {nicer ? 'bg-good/15' : ''}">
		<!-- On one line from 380 px; the check mark used to drop under the temperatures. Narrower, it wraps. -->
		<span class="flex items-center gap-x-1.5 whitespace-nowrap max-[379px]:flex-wrap">
			<WeatherIcon condition={day.condition} size={20} />
			<span class="tabular-nums">
				<span class="font-semibold">{f.temp(day.max)}</span>
				<span class="text-ink-muted">{f.temp(day.min)}</span>
			</span>
			{#if day.rainChance >= 20}
				<span class="text-xs text-rain-soft tabular-nums">{f.percent(day.rainChance)}</span>
			{/if}
			{#if nicer}<Check size={16} class="text-good" aria-hidden="true" />{/if}
		</span>
		<span class="sr-only"
			>{conditionLabel(day.condition)}{nicer ? `, ${m.compare_nicer()}` : ''}</span
		>
	</td>
{/snippet}

<main class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pt-4 md:px-8 md:pt-8">
	<header class="flex items-center gap-3">
		<a
			href={resolve('/p/[coords]/[[name]]', {
				coords: formatCoordinates(data.a),
				name: encodeURIComponent(nameA)
			})}
			aria-label={m.back_to_forecast()}
			class="grid size-11 shrink-0 pill place-items-center"
		>
			<ArrowLeft size={18} aria-hidden="true" />
		</a>
		<h1 class="text-2xl font-extrabold">{title}</h1>
	</header>

	<section class="mt-5 glass p-6">
		<p class="question"><Scale size={18} aria-hidden="true" /> {m.models_question_places()}</p>
		<p class="mt-2 answer">{answer}</p>
		<p class="mt-2">
			{m.compare_tally({
				a: nameA,
				aDays: winsA,
				b: nameB,
				bDays: winsB,
				even: rated - winsA - winsB
			})}
		</p>
		<p class="mt-2 text-sm text-ink-muted">{m.compare_basis()}</p>

		<!-- No sideways scroll: on narrow phones the cells wrap instead. -->
		<div class="mt-4">
			<table class="w-full text-sm">
				<thead class="text-left text-ink-muted">
					<tr>
						<th scope="col" class="py-1 pr-2 font-medium">{m.compare_day()}</th>
						<th scope="col" class="py-1 pr-2 font-medium">{nameA}</th>
						<th scope="col" class="py-1 font-medium">{nameB}</th>
					</tr>
				</thead>
				<tbody>
					{#each days as day, i (day.date)}
						<tr class="border-t border-veil/10">
							<th scope="row" class="py-2 pr-2 text-left font-semibold">
								{i === 0 ? m.today() : f.weekday(day.date)}
							</th>
							{@render cell(day.a, day.better === 'a')}
							{@render cell(day.b, day.better === 'b')}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<SiteFooter />
</main>
