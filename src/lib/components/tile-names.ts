import { m } from '#lib/paraglide/messages.js';
import type { TileId } from '#lib/tiles.js';

/** Each tile's name for the edit mode and Settings: its own question or heading. */
export function tileName(id: TileId): string {
	return {
		umbrella: m.umbrella_question,
		activities: m.go_out_question,
		hours: m.next_hours,
		chart: m.temp_question,
		tomorrow: m.tomorrow_question,
		days: m.ten_days,
		map: m.map_question,
		details: m.today_details,
		charts: m.charts_question,
		wind: m.wind_question,
		dark: m.dark_question,
		past: m.tiles_past
	}[id]();
}
