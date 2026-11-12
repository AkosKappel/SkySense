// The living sky (U-01): the page background follows the sun and the clouds at the place.
// The sun's position comes from the forecast's sunrise and sunset (D-10), not from astronomy code.
import type { Condition, Day } from '#lib/weather.js';

export type SkyKind =
	'night-clear' | 'night-cloudy' | 'dawn' | 'day-clear' | 'day-cloudy' | 'dusk' | 'storm';

type Sky = {
	/** Top to bottom. */
	stops: string[];
	/** The same sky for the light theme (U-05): pale, for dark text. */
	light: string[];
	/** A soft light from the sun or the moon. */
	glow?: { color: string; alpha: number; at: string };
	stars?: boolean;
};

// White text must stay readable on every sky, so even the day sky is a deep blue (U-11); in
// the light theme dark text must, so every light sky is pale. sky.test.ts measures each colour
// under the tile glass.
export const skies: Record<SkyKind, Sky> = {
	'night-clear': {
		stops: ['#0b1026', '#141c47', '#1e1b4b'],
		light: ['#a5b4fc', '#c7d2fe', '#e0e7ff'],
		stars: true
	},
	'night-cloudy': {
		stops: ['#111827', '#1f2937', '#272a3d'],
		light: ['#94a3b8', '#cbd5e1', '#e2e8f0']
	},
	dawn: {
		stops: ['#1e3a8a', '#5b21b6', '#7c2d12'],
		light: ['#c7d2fe', '#f5d0fe', '#fed7aa'],
		glow: { color: '#f59e0b', alpha: 0.2, at: '15% 110%' }
	},
	'day-clear': {
		stops: ['#1c46c4', '#1e40af', '#1e3a8a'],
		light: ['#7dd3fc', '#bae6fd', '#e0f2fe'],
		glow: { color: '#fde68a', alpha: 0.08, at: '85% -10%' }
	},
	'day-cloudy': {
		stops: ['#475569', '#3f4b5e', '#334155'],
		light: ['#cbd5e1', '#e2e8f0', '#f1f5f9']
	},
	dusk: {
		stops: ['#1e3a8a', '#312e81', '#1e1b4b'],
		light: ['#fed7aa', '#e9d5ff', '#c7d2fe'],
		glow: { color: '#f59e0b', alpha: 0.22, at: '85% -10%' }
	},
	storm: {
		stops: ['#1f2937', '#2e1065', '#1e1b4b'],
		light: ['#a8a29e', '#c4b5fd', '#e2e8f0'],
		glow: { color: '#a78bfa', alpha: 0.2, at: '50% -10%' }
	}
};

const GOLDEN_MINUTES = 45;
const OVERCAST: Condition[] = ['cloudy', 'fog', 'drizzle', 'rain', 'showers', 'snow'];

const minutes = (time: string) => Date.parse(`${time}Z`) / 60_000;

export function skyKind(
	at: { time: string; isDay: boolean; condition: Condition },
	day: Pick<Day, 'sunrise' | 'sunset'>
): SkyKind {
	if (at.condition === 'thunder') return 'storm';
	const overcast = OVERCAST.includes(at.condition);
	const t = minutes(at.time);
	if (!overcast && day.sunrise && Math.abs(t - minutes(day.sunrise)) <= GOLDEN_MINUTES)
		return 'dawn';
	if (!overcast && day.sunset && Math.abs(t - minutes(day.sunset)) <= GOLDEN_MINUTES) return 'dusk';
	if (at.isDay) return overcast ? 'day-cloudy' : 'day-clear';
	return overcast ? 'night-cloudy' : 'night-clear';
}

// Fixed positions, so the stars do not jump between renders.
const STARS = [
	[8, 12],
	[18, 30],
	[27, 8],
	[35, 22],
	[44, 5],
	[52, 18],
	[61, 9],
	[68, 28],
	[76, 14],
	[84, 6],
	[91, 24],
	[13, 44],
	[39, 38],
	[57, 41],
	[73, 46],
	[95, 40]
];

/**
 * The sky as a CSS background for both themes: every colour is `light-dark()`, so the page's
 * `color-scheme` picks one and the sky follows a change of theme without a new render.
 */
export function skyBackground(kind: SkyKind): string {
	const sky = skies[kind];
	// Stars are white points, only seen on the dark sky.
	const layers = sky.stars
		? STARS.map(
				([x, y], i) =>
					`radial-gradient(${i % 3 ? 1 : 1.5}px ${i % 3 ? 1 : 1.5}px at ${x}% ${y}%, light-dark(transparent, #fff), transparent)`
			)
		: [];
	if (sky.glow) {
		const alpha = Math.round(sky.glow.alpha * 255)
			.toString(16)
			.padStart(2, '0');
		layers.push(
			`radial-gradient(60rem 40rem at ${sky.glow.at}, ${sky.glow.color}${alpha}, transparent 60%)`
		);
	}
	const stops = sky.stops.map((dark, i) => `light-dark(${sky.light[i]}, ${dark})`);
	layers.push(`linear-gradient(170deg, ${stops.join(', ')})`);
	return layers.join(', ');
}

/** What falls from the sky, for the particle layer. */
export function precipitation(condition: Condition): 'rain' | 'snow' | null {
	if (condition === 'snow') return 'snow';
	if (['drizzle', 'rain', 'showers', 'thunder'].includes(condition)) return 'rain';
	return null;
}
