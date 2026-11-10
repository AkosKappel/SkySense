// "Share today" as a picture (X-04), drawn on a canvas in the browser: no server rendering, no
// image library. Text comes in already translated; this only lays it out.

export type ShareCard = {
	place: string;
	date: string;
	temp: string;
	condition: string;
	highLow: string;
	summary: string;
	/** "Run: 16:00 to 17:00", when there is a good time for the first chosen activity. */
	best: string | null;
	footer: string;
	/** The current sky, top to bottom. */
	sky: string[];
};

export const SIZE = 1080;
const PAD = 88;
const FONT = '"Plus Jakarta Sans Variable", system-ui, sans-serif';

/** Splits `text` into lines that fit `width`, breaking between words. */
function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
	const lines: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/)) {
		const next = line ? `${line} ${word}` : word;
		if (line && context.measureText(next).width > width) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}
	if (line) lines.push(line);
	return lines;
}

export function drawShareCard(canvas: HTMLCanvasElement, card: ShareCard) {
	canvas.width = SIZE;
	canvas.height = SIZE;
	const context = canvas.getContext('2d');
	if (!context) return;

	const sky = context.createLinearGradient(0, 0, 0, SIZE);
	card.sky.forEach((stop, i) => sky.addColorStop(i / Math.max(1, card.sky.length - 1), stop));
	context.fillStyle = sky;
	context.fillRect(0, 0, SIZE, SIZE);

	context.fillStyle = '#ffffff';
	context.textBaseline = 'top';
	let y = PAD;
	const text = (value: string, size: number, weight: number, alpha = 1, gap = 16) => {
		context.font = `${weight} ${size}px ${FONT}`;
		context.globalAlpha = alpha;
		for (const line of wrap(context, value, SIZE - PAD * 2)) {
			context.fillText(line, PAD, y);
			y += size * 1.2;
		}
		y += gap;
	};

	text(card.place, 56, 800, 1, 4);
	text(card.date, 34, 500, 0.85, 40);
	text(card.temp, 200, 700, 1, 0);
	text(card.condition, 44, 500, 1, 8);
	text(card.highLow, 36, 500, 0.85, 56);
	text(card.summary, 48, 700, 1, 32);
	if (card.best) text(card.best, 40, 600, 0.95, 0);

	context.globalAlpha = 0.85;
	context.font = `500 28px ${FONT}`;
	context.fillText(card.footer, PAD, SIZE - PAD - 28);
	context.globalAlpha = 1;
}
