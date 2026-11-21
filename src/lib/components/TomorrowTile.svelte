<script lang="ts">
	import { CalendarDays, Droplets, Wind } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { tomorrowOutlook } from '#lib/tomorrow.js';
	import type { Day, Hour } from '#lib/weather.js';

	// What about tomorrow (F-29), and the next three days as cards (F-30): more room per day than
	// the 10-day rows, each a link to its day view.
	let {
		days,
		hours,
		f,
		class: className = ''
	}: { days: Day[]; hours: Hour[]; f: Formatter; class?: string } = $props();

	const outlook = $derived(tomorrowOutlook(days, hours));
	const next = $derived(
		days.slice(1, 4).map((day) => ({
			day,
			wind: Math.max(0, ...hours.filter((h) => h.time.startsWith(day.date)).map((h) => h.wind))
		}))
	);
	const dayHref = (date: string) =>
		`${resolve('/p/[coords]/[[name]]', {
			coords: page.params.coords ?? '',
			name: encodeURIComponent(page.params.name ?? '')
		})}?day=${date}`;

	const tempText = $derived.by(() => {
		if (!outlook) return '';
		const max = f.temp(outlook.day.max);
		return { warmer: m.tomorrow_warmer, colder: m.tomorrow_colder, same: m.tomorrow_same }[
			outlook.temp.key
		]({ max });
	});

	const fallText = $derived.by(() => {
		if (!outlook) return '';
		const fall = outlook.fall;
		if (fall.key === 'dry') return m.tomorrow_dry();
		if (fall.key === 'from') {
			return {
				rain: m.tomorrow_rain_from,
				snow: m.tomorrow_snow_from,
				thunder: m.tomorrow_thunder_from
			}[fall.kind]({ from: f.time(fall.from) });
		}
		return {
			rain: m.tomorrow_rain_window,
			snow: m.tomorrow_snow_window,
			thunder: m.tomorrow_thunder_window
		}[fall.kind]({ from: f.time(fall.from), until: f.time(fall.until) });
	});
</script>

{#if outlook}
	<section class="glass p-6 {className}">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<p class="question">
					<CalendarDays size={18} aria-hidden="true" />
					{m.tomorrow_question()}
				</p>
				<p class="mt-2 answer">{tempText} {fallText}</p>
				<p class="mt-2 text-sm text-ink-muted">
					{f.weekday(outlook.day.date)} · {m.tomorrow_detail({
						min: f.temp(outlook.day.min),
						chance: f.percent(outlook.day.rainChance)
					})}
				</p>
			</div>
			<WeatherIcon condition={outlook.condition} size={48} />
		</div>

		<ul class="mt-4 grid grid-cols-3 gap-2 sm:gap-3" aria-label={m.next_days()}>
			{#each next as { day, wind } (day.date)}
				<li>
					<a
						href={dayHref(day.date)}
						class="flex h-full flex-col items-center gap-1 rounded-2xl bg-veil/5 px-2 py-3 text-center transition hover:bg-veil/10 sm:py-4"
					>
						<span class="text-sm font-semibold">{f.weekday(day.date)}</span>
						<WeatherIcon condition={day.condition} size={36} class="my-1" />
						<span class="sr-only">{conditionLabel(day.condition)}</span>
						<span class="tabular-nums">
							<span class="sr-only">{`${m.high()} `}</span><span class="text-lg font-bold">
								{f.temp(day.max)}
							</span>
							<span class="sr-only">{` ${m.low()} `}</span><span class="text-ink-muted">
								{f.temp(day.min)}
							</span>
						</span>
						<span class="flex items-center gap-1 text-xs text-rain-soft tabular-nums">
							<Droplets size={12} aria-hidden="true" />
							<span class="sr-only">{`${m.rain_chance_label()} `}</span>{f.percent(day.rainChance)}
							{#if day.rain >= 0.1}<span class="hidden min-[400px]:inline">
									· {f.rain(day.rain)}
								</span>{/if}
						</span>
						<span class="flex items-center gap-1 text-xs text-ink-muted tabular-nums">
							<Wind size={12} aria-hidden="true" />
							<span class="sr-only">{`${m.wind_speed()} `}</span>{f.wind(wind)}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
