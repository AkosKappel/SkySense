<script lang="ts">
	import { skies, skyBackground, type SkyKind } from '#lib/sky.js';

	// The place's sky behind the tiles, plus falling rain or snow. Particles stay off under
	// reduced motion and pause while the tab is hidden.
	let { kind, falling }: { kind: SkyKind; falling: 'rain' | 'snow' | null } = $props();

	let canvas = $state<HTMLCanvasElement>();

	// The phone's status bar takes the top of the sky (U-05), and the default again on leaving.
	$effect(() => {
		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (!meta) return;
		const before = meta.content;
		meta.content = skies[kind].stops[0];
		return () => {
			meta.content = before;
		};
	});

	$effect(() => {
		if (!canvas || !falling || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const context = canvas.getContext('2d');
		if (!context) return;
		const snow = falling === 'snow';
		let width = 0;
		let height = 0;
		const resize = () => {
			width = canvas!.width = innerWidth;
			height = canvas!.height = innerHeight;
		};
		resize();
		const drops = Array.from({ length: snow ? 70 : 90 }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			speed: snow ? 0.6 + Math.random() * 0.8 : 7 + Math.random() * 5,
			size: snow ? 1 + Math.random() * 2 : 10 + Math.random() * 10
		}));
		let frame = 0;
		const draw = () => {
			context.clearRect(0, 0, width, height);
			context.fillStyle = context.strokeStyle = 'rgb(255 255 255 / 0.35)';
			context.lineWidth = 1;
			for (const drop of drops) {
				drop.y += drop.speed;
				if (snow) drop.x += Math.sin(drop.y / 40) * 0.4;
				if (drop.y > height) [drop.y, drop.x] = [-drop.size, Math.random() * width];
				context.beginPath();
				if (snow) {
					context.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
					context.fill();
				} else {
					context.moveTo(drop.x, drop.y);
					context.lineTo(drop.x - 1.5, drop.y + drop.size);
					context.stroke();
				}
			}
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);
		addEventListener('resize', resize);
		return () => {
			cancelAnimationFrame(frame);
			removeEventListener('resize', resize);
		};
	});
</script>

<div
	class="pointer-events-none fixed inset-0 -z-1 forced-colors:hidden"
	style:background={skyBackground(kind)}
	data-sky={kind}
>
	{#if falling}<canvas bind:this={canvas} class="size-full" aria-hidden="true"></canvas>{/if}
</div>
