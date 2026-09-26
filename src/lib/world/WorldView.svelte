<script lang="ts">
	import { Application } from 'pixi.js';
	import type { Attachment } from 'svelte/attachments';
	import { WorldRenderer } from './world-renderer';

	/** Runs Pixi on the canvas for as long as it is mounted. */
	function pixi(): Attachment<HTMLCanvasElement> {
		return (canvas) => {
			const app = new Application();
			let renderer: WorldRenderer | null = null;
			let unmounted = false;

			// init is async; the canvas may be unmounted before it finishes.
			app
				.init({
					canvas,
					resizeTo: canvas.parentElement ?? window,
					background: '#0e0f14',
					antialias: false,
					roundPixels: true,
					autoDensity: true,
					resolution: devicePixelRatio
				})
				.then(() => {
					if (unmounted) app.destroy();
					else renderer = new WorldRenderer(app);
				});

			return () => {
				unmounted = true;
				if (renderer) {
					renderer.destroy();
					app.destroy();
				}
			};
		};
	}
</script>

<div class="world">
	<canvas {@attach pixi()}></canvas>
</div>

<style>
	.world {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	canvas {
		display: block;
	}
</style>
