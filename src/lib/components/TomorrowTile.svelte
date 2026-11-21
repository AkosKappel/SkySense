<script lang="ts">
	import { CalendarDays } from '@lucide/svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { tomorrowOutlook } from '#lib/tomorrow.js';
	import type { Day, Hour } from '#lib/weather.js';

	let { days, hours, f }: { days: Day[]; hours: Hour[]; f: Formatter } = $props();

	const outlook = $derived(tomorrowOutlook(days, hours));

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
	<section class="glass p-6">
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
	</section>
{/if}
