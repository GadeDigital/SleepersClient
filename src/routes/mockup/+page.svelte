<script lang="ts">
	import '$lib/render/fonts.css';
	import EngineHost from '$lib/render/EngineHost.svelte';
	import type { Engine } from '$lib/render/engine';
	import {
		loadPixelSize,
		savePixelSize,
		type CanvasLayout,
		type PixelSize
	} from '$lib/render/pixel';
	import { TestView } from '$lib/render/views/TestView';
	import PixelSizeButtons from '$lib/ui/PixelSizeButtons.svelte';

	// For now (M6.1 task P1) this page shows the engine's test view; P2 turns
	// it into the port of the zoom-ladder mockup.
	let pixelSize = $state<PixelSize>(loadPixelSize());
	let layout = $state.raw<CanvasLayout | null>(null);

	function setPixelSize(size: PixelSize) {
		pixelSize = size;
		savePixelSize(size);
	}

	function setup(engine: Engine) {
		engine.onLayout = (l) => (layout = l);
		engine.add(new TestView(engine.labelLayer));
	}
</script>

<svelte:head>
	<title>Sleepers · zoom ladder mockup</title>
</svelte:head>

<main>
	<EngineHost {pixelSize} {setup} />

	<section class="card">
		<div class="eyebrow">Sleepers · engine test</div>
		<PixelSizeButtons value={pixelSize} onchange={setPixelSize} />
		{#if layout}
			<div class="readout">
				buffer {layout.bufferWidth} × {layout.bufferHeight} art px ·
				{Number.isInteger(layout.physicalPerArt)
					? layout.physicalPerArt
					: layout.physicalPerArt.toFixed(2)} physical px per art px
			</div>
		{/if}
	</section>
</main>

<style>
	main {
		position: fixed;
		inset: 0;
		background: #05070d;
		color: #cdd6e8;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
	}

	.card {
		position: absolute;
		top: calc(16px + env(safe-area-inset-top, 0px));
		left: calc(16px + env(safe-area-inset-left, 0px));
		width: min(360px, calc(100% - 32px));
		box-sizing: border-box;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: rgba(9, 13, 23, 0.84);
		border: 1px solid #26314a;
		border-radius: 2px;
		backdrop-filter: blur(6px);
	}

	.eyebrow {
		font:
			500 10.5px/1 'IBM Plex Mono',
			ui-monospace,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #7c89a2;
	}

	.readout {
		font:
			400 11.5px/1.4 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #6fd6d0;
		font-variant-numeric: tabular-nums;
	}
</style>
