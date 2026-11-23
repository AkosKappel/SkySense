<script lang="ts">
	import { BriefcaseBusiness } from '@lucide/svelte';
	import type { CommuteCheck } from '#lib/commute.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	// The commute check's line (X-19). Loaded only for readers who set a commute, so its sentences
	// stay out of everyone else's first load.
	let { check, f }: { check: CommuteCheck; f: Formatter } = $props();

	const text = $derived.by(() => {
		const [first, second] = check.trips;
		if (!second) {
			const time = f.time(first.at);
			return first.wet ? m.commute_one_wet({ time }) : m.commute_one_dry({ time });
		}
		const values = { leave: f.time(first.at), back: f.time(second.at) };
		const key = `${first.wet ? 'wet' : 'dry'}_${second.wet ? 'wet' : 'dry'}` as const;
		const today = {
			dry_dry: m.commute_today_dry_dry,
			wet_dry: m.commute_today_wet_dry,
			dry_wet: m.commute_today_dry_wet,
			wet_wet: m.commute_today_wet_wet
		};
		const tomorrow = {
			dry_dry: m.commute_tomorrow_dry_dry,
			wet_dry: m.commute_tomorrow_wet_dry,
			dry_wet: m.commute_tomorrow_dry_wet,
			wet_wet: m.commute_tomorrow_wet_wet
		};
		return (check.day === 'today' ? today : tomorrow)[key](values);
	});
</script>

<p class="flex items-start gap-1.5 text-sm text-ink-muted">
	<BriefcaseBusiness size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
	{text}
</p>
