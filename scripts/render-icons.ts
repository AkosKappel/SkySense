// Renders the logo (src/lib/assets/favicon.svg) to the PNG icons and the social preview in
// static/. Run after changing the logo: `node scripts/render-icons.ts`.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const logo = readFileSync('src/lib/assets/favicon.svg', 'utf8');
// Maskable icons are cropped to a circle by some launchers: full-bleed sky, logo at 70%.
const maskable = logo
	.replaceAll('rx="112"', '')
	.replace('<g fill', '<g transform="translate(77 77) scale(.7)" fill')
	.replace('<circle cx="334"', '<circle transform="translate(77 77) scale(.7)" cx="334"');

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(html: string, width: number, height: number, path?: string) {
	await page.setViewportSize({ width, height });
	await page.setContent(`<body style="margin:0">${html}</body>`);
	const png = await page.screenshot({ path, omitBackground: true });
	if (path) console.log('wrote', path);
	return png;
}

/** An ICO file holding PNG images, which every browser since IE Vista reads. */
function ico(images: { size: number; png: Buffer }[]) {
	const header = Buffer.alloc(6 + 16 * images.length);
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(images.length, 4);
	let offset = header.length;
	images.forEach(({ size, png }, i) => {
		const entry = 6 + 16 * i;
		header.writeUInt8(size, entry); // width and height; 0 would mean 256
		header.writeUInt8(size, entry + 1);
		header.writeUInt16LE(1, entry + 4); // colour planes
		header.writeUInt16LE(32, entry + 6); // bits per pixel
		header.writeUInt32LE(png.length, entry + 8);
		header.writeUInt32LE(offset, entry + 12);
		offset += png.length;
	});
	return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const sized = (svg: string, size: number) =>
	svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
await render(sized(logo, 192), 192, 192, 'static/icon-192.png');
await render(sized(logo, 512), 512, 512, 'static/icon-512.png');
await render(sized(maskable, 512), 512, 512, 'static/icon-maskable-512.png');
await render(sized(maskable, 180), 180, 180, 'static/apple-touch-icon.png');
// For crawlers and browsers that ask for /favicon.ico whatever the page links.
const icons = [];
for (const size of [16, 32, 48]) icons.push({ size, png: await render(sized(logo, size), size, size) });
writeFileSync('static/favicon.ico', ico(icons));
console.log('wrote static/favicon.ico');

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
