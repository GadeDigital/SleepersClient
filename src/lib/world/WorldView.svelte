<script lang="ts">
	import '$lib/render/fonts.css';
	import { on } from 'svelte/events';
	import EngineHost from '$lib/render/EngineHost.svelte';
	import type { Engine } from '$lib/render/engine';
	import { loadPixelSize, savePixelSize, type PixelSize } from '$lib/render/pixel';
	import { TileView } from '$lib/render/views/TileView';
	import type { GameState } from '$lib/net/game-state.svelte';
	import type { ActionKind, Direction } from '$lib/proto/sleepers/v1/world_pb';
	import PixelSizeButtons from '$lib/ui/PixelSizeButtons.svelte';
	import { MoveInput } from './move-input';

	interface Props {
		game: GameState;
		/** Asks the server for one step. */
		onmove: (direction: Direction) => void;
		/** Asks the server for an action on an adjacent tile. */
		onact: (kind: ActionKind, direction: Direction) => void;
		/** Tells the page which action is being aimed, if any. */
		onaiming: (kind: ActionKind | null) => void;
	}

	let { game, onmove, onact, onaiming }: Props = $props();

	let pixelSize = $state<PixelSize>(loadPixelSize());

	function setPixelSize(size: PixelSize) {
		pixelSize = size;
		savePixelSize(size);
	}

	/**
	 * Draws the world in three.js (ADR 051, ADR 057) and runs the movement,
	 * action and camera keys, for as long as the view is mounted.
	 */
	function setup(engine: Engine) {
		const view = new TileView(game, engine.labelLayer);
		engine.add(view);
		const input = new MoveInput(game, onmove, onact, onaiming, {
			heading: () => view.targetYaw,
			rotate: (step) => view.rotate(step)
		});
		view.aim = () => (input.aiming === null ? null : { kind: input.aiming, dir: input.direction });
		engine.onFrame = () => input.update(game.clock.now(performance.now()));

		// Keys are ignored while typing or with a modifier, so browser
		// shortcuts such as Ctrl+W keep working.
		const typing = (e: KeyboardEvent) =>
			e.ctrlKey ||
			e.metaKey ||
			e.altKey ||
			(e.target instanceof HTMLElement && e.target.closest('input, textarea') !== null);
		const canvas = engine.renderer.domElement;
		const ndc = (e: PointerEvent) => {
			const r = canvas.getBoundingClientRect();
			return {
				x: ((e.clientX - r.left) / r.width) * 2 - 1,
				y: -((e.clientY - r.top) / r.height) * 2 + 1
			};
		};
		const offs = [
			on(window, 'keydown', (e) => {
				if (!typing(e) && input.keydown(e.code, e.repeat)) e.preventDefault();
			}),
			on(window, 'keyup', (e) => input.keyup(e.code)),
			on(window, 'blur', () => input.release()),
			on(canvas, 'pointermove', (e) => view.hover(e.pointerType === 'mouse' ? ndc(e) : null)),
			on(canvas, 'pointerleave', () => view.hover(null))
		];
		return () => {
			for (const off of offs) off();
			engine.onFrame = () => {};
		};
	}
</script>

<div class="world">
	<EngineHost {pixelSize} {setup} />
	{#key game.mapChanges}
		<!-- Taking stairs, a lift or a door fades in the new map (ADR 074). -->
		{#if game.mapChanges > 0}
			<div class="map-fade" aria-hidden="true"></div>
		{/if}
	{/key}
	<section class="view card">
		<PixelSizeButtons value={pixelSize} onchange={setPixelSize} />
		<p class="keys">
			<b>WASD</b> or <b>arrows</b> walk up the screen · <b>Q / E</b> turn · <b>L</b> sleep in a bed
		</p>
	</section>
</div>

<style>
	.world {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #05070d;
	}

	.map-fade {
		position: absolute;
		inset: 0;
		background: #05070d;
		pointer-events: none;
		animation: map-fade 0.7s ease-out forwards;
	}

	@keyframes map-fade {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	.card {
		position: absolute;
		top: 1rem;
		left: 1rem;
		width: min(22rem, calc(100% - 2rem));
		box-sizing: border-box;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: rgba(9, 13, 23, 0.84);
		border: 1px solid #26314a;
		border-radius: 2px;
	}

	.keys {
		margin: 0;
		font:
			400 11px/1.5 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #7c89a2;
	}

	.keys b {
		color: #cdd6e8;
		font-weight: 500;
	}

	/* A character's speech bubble stacked over its name (ADR 051: HTML text). */
	.world :global(.char-tag) {
		position: absolute;
		left: 0;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		will-change: transform;
	}

	.world :global(.char-tag .lbl) {
		position: static;
	}

	.world :global(.char-tag.down) {
		opacity: 0.5;
	}

	.world :global(.bubble) {
		max-width: 16em;
		padding: 0.3em 0.55em;
		background: rgba(14, 15, 20, 0.8);
		border-radius: 0.4em;
		color: #f2f2f2;
		font:
			400 13px/1.35 'IBM Plex Sans',
			system-ui,
			sans-serif;
		text-align: center;
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.world :global(.bubble[hidden]),
	.world :global(.progress[hidden]) {
		display: none;
	}

	/* An action under way (ADR 039), under the name. */
	.world :global(.progress) {
		width: 28px;
		height: 4px;
		padding: 1px;
		background: rgba(5, 7, 13, 0.85);
		border: 1px solid #26314a;
	}

	.world :global(.progress i) {
		display: block;
		height: 100%;
		background: #e0a458;
	}

	.world :global(.bubble.muffled) {
		color: #8a8d99;
	}

	.world :global(.bubble.soft) {
		font-style: italic;
	}

	.world :global(.bubble.loud) {
		font-weight: 600;
	}
</style>
