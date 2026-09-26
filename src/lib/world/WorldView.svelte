<script lang="ts">
	import { Application } from 'pixi.js';
	import type { Attachment } from 'svelte/attachments';
	import type { GameState } from '$lib/net/game-state.svelte';
	import { WorldRenderer } from './world-renderer';

	interface Props {
		game: GameState;
	}

	let { game }: Props = $props();

	/** Runs Pixi on the canvas for as long as it is mounted. */
	function pixi(g: GameState): Attachment<HTMLCanvasElement> {
		return (canvas) => {
			const app = new Application();
			let renderer = $state.raw<WorldRenderer | null>(null);
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
					else renderer = new WorldRenderer(app, g);
				});

			// A snapshot replaces the room whole, so this runs once per snapshot.
			$effect(() => {
				renderer?.setRoom(g.room);
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
	<canvas {@attach pixi(game)}></canvas>
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
