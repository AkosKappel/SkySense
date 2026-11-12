import { describe, expect, it } from 'vitest';
import { skies, skyKind, type SkyKind } from './sky.js';

type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const mix = (top: Rgb, alpha: number, under: Rgb): Rgb =>
	under.map((c, i) => top[i] * alpha + c * (1 - alpha)) as Rgb;
const luminance = (color: Rgb) => {
	const [r, g, b] = color.map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

const WHITE: Rgb = [255, 255, 255];
/** The `glass` utility: white at 8% over the sky. */
const GLASS = 0.08;
/** `ink-muted` in layout.css: white at 85%. */
const MUTED = 0.85;

describe('sky contrast (WCAG AA, 4.5:1)', () => {
	for (const [kind, sky] of Object.entries(skies)) {
		const backgrounds = sky.stops.map(rgb);
		if (sky.glow) {
			const glow = rgb(sky.glow.color);
			backgrounds.push(...backgrounds.map((bg) => mix(glow, sky.glow!.alpha, bg)));
		}

		it(`keeps muted text readable on glass over ${kind}`, () => {
			for (const bg of backgrounds) {
				const tile = mix(WHITE, GLASS, bg);
				expect(contrast(mix(WHITE, MUTED, tile), tile)).toBeGreaterThanOrEqual(4.5);
			}
		});
	}
});

describe('light sky contrast (WCAG AA, 4.5:1)', () => {
	const INK: Rgb = [15, 23, 42];
	/** The `glass` utility in the light theme: white at 62% over the sky. */
	const LIGHT_GLASS = 0.62;
	/** `ink-muted` in the light theme: slate at 78%. */
	const LIGHT_MUTED = 0.78;
	/** The light theme's accent colours, used as text (layout.css). */
	const accents = ['#92400e', '#075985', '#065f46', '#9f1239'];

	for (const [kind, sky] of Object.entries(skies)) {
		const backgrounds = sky.light.map(rgb);
		if (sky.glow) {
			const glow = rgb(sky.glow.color);
			backgrounds.push(...backgrounds.map((bg) => mix(glow, sky.glow!.alpha, bg)));
		}

		it(`keeps muted text and accents readable on glass over light ${kind}`, () => {
			for (const bg of backgrounds) {
				const tile = mix(WHITE, LIGHT_GLASS, bg);
				expect(contrast(mix(INK, LIGHT_MUTED, tile), tile)).toBeGreaterThanOrEqual(4.5);
				for (const accent of accents) {
					expect(contrast(rgb(accent), tile), accent).toBeGreaterThanOrEqual(4.5);
				}
			}
		});
	}
});

describe('skyKind', () => {
	const day = { sunrise: '2026-11-10T06:50', sunset: '2026-11-10T16:19' };
	const at = (time: string, isDay: boolean, condition = 'clear' as const): SkyKind =>
		skyKind({ time: `2026-11-10T${time}`, isDay, condition }, day);

	it('follows the sun through the day', () => {
		expect(at('03:00', false)).toBe('night-clear');
		expect(at('07:00', true)).toBe('dawn');
		expect(at('12:00', true)).toBe('day-clear');
		expect(at('16:00', true)).toBe('dusk');
		expect(at('17:00', false)).toBe('dusk');
		expect(at('18:00', false)).toBe('night-clear');
	});

	it('greys over when it is overcast, even at sunrise', () => {
		expect(skyKind({ time: '2026-11-10T07:00', isDay: true, condition: 'rain' }, day)).toBe(
			'day-cloudy'
		);
		expect(skyKind({ time: '2026-11-10T22:00', isDay: false, condition: 'fog' }, day)).toBe(
			'night-cloudy'
		);
	});

	it('darkens for thunderstorms', () => {
		expect(skyKind({ time: '2026-11-10T12:00', isDay: true, condition: 'thunder' }, day)).toBe(
			'storm'
		);
	});

	it('uses day or night alone in polar night and midnight sun', () => {
		const polar = { sunrise: null, sunset: null };
		expect(skyKind({ time: '2026-12-20T12:00', isDay: false, condition: 'clear' }, polar)).toBe(
			'night-clear'
		);
	});
});
