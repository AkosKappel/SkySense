// Renders the logo (src/lib/assets/favicon.svg) to the PNG icons and the social preview in
// static/. Run after changing the logo: `node scripts/render-icons.ts`.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const logo = readFileSync('src/lib/assets/favicon.svg', 'utf8');
// Maskable icons are cropped to a circle by some launchers: full-bleed sky, logo at 70%.
const maskable = logo
	.replaceAll('rx="112"', '')
	.replace('<g fill', '<g transform="translate(77 77) scale(.7)" fill')
	.replace('<circle cx="334"', '<circle transform="translate(77 77) scale(.7)" cx="334"');

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(html: string, width: number, height: number, path: string) {
	await page.setViewportSize({ width, height });
	await page.setContent(`<body style="margin:0">${html}</body>`);
	await page.screenshot({ path, omitBackground: true });
	console.log('wrote', path);
}

const sized = (svg: string, size: number) =>
	svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
await render(sized(logo, 192), 192, 192, 'static/icon-192.png');
await render(sized(logo, 512), 512, 512, 'static/icon-512.png');
await render(sized(maskable, 512), 512, 512, 'static/icon-maskable-512.png');
await render(sized(maskable, 180), 180, 180, 'static/apple-touch-icon.png');

const font = 'font-family: system-ui, sans-serif';
await render(
	`<div style="width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;background:radial-gradient(60rem 40rem at 85% -10%, #f59e0b38, transparent 60%), linear-gradient(170deg, #1e3a8a, #312e81, #1e1b4b);color:#fff;${font}">
		${sized(logo, 220)}
		<div>
			<div style="font-size:88px;font-weight:800;letter-spacing:-2px">SkySense</div>
			<div style="font-size:38px;opacity:.85;margin-top:8px">The weather, made sense of.</div>
		</div>
	</div>`,
	1200,
	630,
	'static/og.png'
);
await browser.close();
