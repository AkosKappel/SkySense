<script lang="ts">
	import { Moon, Sparkles, Sunset, Telescope } from '@lucide/svelte';
	import { darkness, daylightTrend } from '#lib/daylight.js';
	import type { Formatter } from '#lib/format.js';
	import { CLOUDY_NIGHT, meteorPeak, nightClouds } from '#lib/meteors.js';
	import { moon, nextPhase } from '#lib/moon.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { Forecast } from '#lib/weather.js';

	// When it gets dark, the moon and tonight's sky. Loaded when scrolled near: its many lines
	// (moon phases, meteor showers, planets, eclipses) would otherwise all load with the page.
	let { forecast, f }: { forecast: Forecast; f: Formatter } = $props();

	const now = $derived(forecast.current);
	const today = $derived(forecast.days[0]);
	const dark = $derived(darkness(now.time, today, forecast.days[1], forecast.hours));
	const daylight = $derived.by(() => {
		const trend = daylightTrend(today, forecast.days[1]);
		if (!trend) return null;
		const length = f.duration(trend.minutes);
		const minutes = Math.round(Math.abs(trend.change));
		if (minutes === 0) return m.daylight_steady({ length });
		return trend.change > 0
			? m.daylight_longer({ length, minutes })
			: m.daylight_shorter({ length, minutes });
	});
	// Tonight's moon, at 22:00 local time (H-05).
	const tonight = $derived(moon(`${today.date}T22:00`));
	const moonPhase = $derived(
		{
			new: m.moon_new,
			waxingCrescent: m.moon_waxingCrescent,
			firstQuarter: m.moon_firstQuarter,
			waxingGibbous: m.moon_waxingGibbous,
			full: m.moon_full,
			waningGibbous: m.moon_waningGibbous,
			lastQuarter: m.moon_lastQuarter,
			waningCrescent: m.moon_waningCrescent
		}[tonight.phase]()
	);

	// The moon's next rise and set in the order they come, then the sooner of the next full and
	// new moon (H-07); from `/api/forecast`, which computes them on the server.
	const moonEvents = $derived.by(() => {
		const sky = forecast.sky;
		if (!sky) return [];
		const later = (at: string) => !at.startsWith(today.date);
		const times = [
			sky.moonrise && {
				at: sky.moonrise,
				text: (later(sky.moonrise) ? m.moon_rise_tomorrow : m.moon_rise)({
					time: f.time(sky.moonrise)
				})
			},
			sky.moonset && {
				at: sky.moonset,
				text: (later(sky.moonset) ? m.moon_set_tomorrow : m.moon_set)({ time: f.time(sky.moonset) })
			}
		]
			.filter((event) => !!event)
			.sort((a, b) => a.at.localeCompare(b.at))
			.map((event) => event.text);
		const next = nextPhase(sky, today.date);
		const phase = next.today
			? (next.phase === 'full' ? m.moon_full_today : m.moon_new_today)({ time: f.time(next.at) })
			: (next.phase === 'full' ? m.moon_next_full : m.moon_next_new)({
					day: f.date(next.at.slice(0, 10))
				});
		return [...times, phase];
	});

	const meteors = $derived.by(() => {
		const peak = meteorPeak(today.date);
		if (!peak) return null;
		const shower = {
			quadrantids: m.shower_quadrantids,
			lyrids: m.shower_lyrids,
			etaAquariids: m.shower_etaAquariids,
			deltaAquariids: m.shower_deltaAquariids,
			perseids: m.shower_perseids,
			orionids: m.shower_orionids,
			leonids: m.shower_leonids,
			geminids: m.shower_geminids
		}[peak.shower.id]();
		const rate = peak.shower.rate;
		if (peak.days === 0) return m.meteor_tonight({ shower, rate });
		const tomorrow = forecast.days[1]?.date;
		const clouds = tomorrow ? nightClouds(forecast.hours, tomorrow) : null;
		return clouds !== null && clouds >= CLOUDY_NIGHT
			? m.meteor_tomorrow_cloudy({ shower })
			: m.meteor_tomorrow({ shower, rate });
	});

	// An eclipse within two weeks, the bright planets and the aurora tonight (H-07), and whether
	// clouds will hide tonight's sky; all but the clouds computed on the server.
	const skyLines = $derived.by(() => {
		const sky = forecast.sky;
		if (!sky) return [];
		const lines: string[] = [];
		if (sky.eclipse) {
			const { body, kind, at } = sky.eclipse;
			const eclipse =
				body === 'moon'
					? kind === 'total'
						? m.eclipse_moon_total
						: m.eclipse_moon_partial
					: {
							total: m.eclipse_sun_total,
							annular: m.eclipse_sun_annular,
							partial: m.eclipse_sun_partial
						}[kind];
			lines.push(eclipse({ day: f.date(at.slice(0, 10)), time: f.time(at) }));
		}
		if (sky.planets?.length) {
			const planetName = {
				venus: m.planet_venus,
				jupiter: m.planet_jupiter,
				mars: m.planet_mars,
				saturn: m.planet_saturn
			};
			const names = sky.planets.map((planet) => planetName[planet]());
			const list = new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(names);
			lines.push(m.planets_up({ planets: list }));
		}
		if (sky.aurora) {
			const kp = new Intl.NumberFormat(getLocale()).format(sky.aurora.kp);
			lines.push((sky.aurora.south ? m.aurora_south : m.aurora_north)({ kp }));
		}
		const tonight = !!sky.planets?.length || !!sky.aurora || meteorPeak(today.date)?.days === 0;
		const clouds = nightClouds(forecast.hours, today.date);
		if (tonight && clouds !== null && clouds >= CLOUDY_NIGHT) lines.push(m.sky_cloudy_tonight());
		return lines;
	});
</script>

<section class="glass p-6">
	<p class="question"><Sunset size={18} aria-hidden="true" /> {m.dark_question()}</p>
	{#if dark.kind === 'sets'}
		<p class="mt-2 answer">{f.time(dark.at)}</p>
		{#if today.sunrise}<p class="mt-2 text-sm text-ink-muted">
				{m.sunrise_was({ time: f.time(today.sunrise) })}
			</p>{/if}
	{:else if dark.kind === 'dark'}
		<p class="mt-2 answer">{m.dark_now()}</p>
		{#if dark.sunrise}<p class="mt-2 text-sm text-ink-muted">
				{m.sunrise_at({ time: f.time(dark.sunrise) })}
			</p>{/if}
	{:else if dark.kind === 'polar-night'}
		<p class="mt-2 answer">{m.polar_night()}</p>
	{:else}
		<p class="mt-2 answer">{m.midnight_sun()}</p>
	{/if}
	{#if daylight}<p class="mt-2 text-sm text-ink-muted">{daylight}</p>{/if}
	<p class="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
		<Moon size={14} aria-hidden="true" />
		{m.moon_line({ phase: moonPhase, percent: f.percent(tonight.illumination * 100) })}
	</p>
	{#if moonEvents.length}<p class="mt-1 pl-5 text-sm text-ink-muted">
			{moonEvents.join(' ')}
		</p>{/if}
	{#if meteors}<p class="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
			<Sparkles size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
			{meteors}
		</p>{/if}
	{#if skyLines.length}<p class="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
			<Telescope size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
			{skyLines.join(' ')}
		</p>{/if}
</section>
