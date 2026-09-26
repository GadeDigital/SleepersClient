<script lang="ts">
	import { Application } from 'pixi.js';
	import type { Attachment } from 'svelte/attachments';
	import { on } from 'svelte/events';
	import type { GameState } from '$lib/net/game-state.svelte';
	import type { Direction } from '$lib/proto/glyph/v1/world_pb';
	import { MoveInput } from './move-input';
	import { WorldRenderer } from './world-renderer';

	interface Props {
		game: GameState;
		/** Asks the server for one step. */
		onmove: (direction: Direction) => void;
	}

	let { game, onmove }: Props = $props();

	/** Runs Pixi on the canvas, and the movement keys, for as long as it is mounted. */
	function pixi(g: GameState, move: (direction: Direction) => void): Attachment<HTMLCanvasElement> {
		return (canvas) => {
			const app = new Application();
			const input = new MoveInput(g, move);
			const followUp = () => input.update(g.clock.now(performance.now()));
			let renderer = $state.raw<WorldRenderer | null>(null);
			let unmounted = false;

			// init is async; the canvas may be unmounted before it finishes.
			// Resolution 1 and no autoDensity: the renderer sizes the canvas in
			// physical pixels itself, and CSS stretches it over the host.
			app
				.init({
					canvas,
					background: '#0e0f14',
					antialias: false,
					roundPixels: true,
					autoDensity: false,
					resolution: 1
				})
				.then(() => {
					if (unmounted) {
						app.destroy();
						return;
					}
					renderer = new WorldRenderer(app, g);
					app.ticker.add(followUp);
				});

			// Movement keys, ignored while typing or with a modifier so browser
			// shortcuts such as Ctrl+W keep working.
			const typing = (e: KeyboardEvent) =>
				e.ctrlKey ||
				e.metaKey ||
				e.altKey ||
				(e.target instanceof HTMLElement && e.target.closest('input, textarea') !== null);
			const offKeydown = on(window, 'keydown', (e) => {
				if (!typing(e) && input.keydown(e.code, e.repeat)) e.preventDefault();
			});
			const offKeyup = on(window, 'keyup', (e) => input.keyup(e.code));
			const offBlur = on(window, 'blur', () => input.release());

			// The canvas's exact size in physical pixels. When the backing store
			// matches device-pixel-content-box, the browser draws the canvas 1:1
			// onto the screen's pixels at any browser zoom. Where that box is
			// missing, or disagrees with devicePixelRatio (some emulated
			// displays), work the size out from the CSS size instead.
			let size = $state.raw({ width: 1, height: 1, dpr: 1 });
			const observer = new ResizeObserver(([entry]) => {
				const dpr = window.devicePixelRatio;
				const width = entry.contentRect.width * dpr;
				const height = entry.contentRect.height * dpr;
				const box = entry.devicePixelContentBoxSize?.[0];
				const exact =
					box && Math.abs(box.inlineSize - width) <= 1 && Math.abs(box.blockSize - height) <= 1;
				size = exact
					? { width: box.inlineSize, height: box.blockSize, dpr }
					: { width: Math.round(width), height: Math.round(height), dpr };
			});
			try {
				observer.observe(canvas, { box: 'device-pixel-content-box' });
			} catch {
				observer.observe(canvas);
			}

			$effect(() => {
				renderer?.resize(size.width, size.height, size.dpr);
			});

			// A snapshot replaces the room whole, so this runs once per snapshot.
			$effect(() => {
				renderer?.setRoom(g.room);
			});

			return () => {
				offKeydown();
				offKeyup();
				offBlur();
				observer.disconnect();
				unmounted = true;
				if (renderer) {
					app.ticker.remove(followUp);
					renderer.destroy();
					app.destroy();
				}
			};
		};
	}
</script>

<div class="world">
	<canvas {@attach pixi(game, onmove)}></canvas>
</div>

<style>
	.world {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
