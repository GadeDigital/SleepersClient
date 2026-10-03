<script lang="ts">
	import '$lib/render/fonts.css';
	import { on } from 'svelte/events';
	import EngineHost from '$lib/render/EngineHost.svelte';
	import type { Engine } from '$lib/render/engine';
	import { loadPixelSize, savePixelSize, type PixelSize } from '$lib/render/pixel';
	import { INFO } from '$lib/render/views/mock/data';
	import { MockLadder } from '$lib/render/views/mock/ladder';
	import ViewInfo from '$lib/ui/ViewInfo.svelte';
	import ZoomLadder from '$lib/ui/ZoomLadder.svelte';

	// The zoom-ladder mockup (M6.1 task P2): a port of
	// docs/reference/zoom-ladder-mockup.html in sleepers-server, on mock data.

	const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	const NAMES = Object.fromEntries(Object.entries(INFO).map(([n, i]) => [n, i.name]));

	let pixelSize = $state<PixelSize>(loadPixelSize());
	let level = $state(1);
	let address = $state('');
	let navOpen = $state(false);
	let toast = $state<string | null>(null);
	/** The fade overlay, set while it is mounted. */
	let flashEl: HTMLDivElement | undefined;
	let ladder: MockLadder | null = null;

	function setPixelSize(size: PixelSize) {
		pixelSize = size;
		savePixelSize(size);
	}

	function flash() {
		if (reduceMotion) return;
		flashEl?.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
	}

	function setup(engine: Engine) {
		const canvas = engine.renderer.domElement;
		let first = true;
		const l = new MockLadder(
			engine,
			{
				level: (n) => {
					level = n;
					// No fade on the first view, as in the reference.
					if (!first) flash();
					first = false;
				},
				toast: (message) => (toast = message),
				status: (a, nav) => {
					address = a;
					navOpen = nav;
				}
			},
			reduceMotion
		);
		ladder = l;
		const offs = [
			on(window, 'keydown', (e) => l.keydown(e)),
			on(canvas, 'wheel', (e) => l.wheel(e), { passive: false }),
			on(canvas, 'pointerdown', (e) => l.pointerdown(e)),
			on(canvas, 'pointermove', (e) => l.pointermove(e)),
			on(canvas, 'pointerup', (e) => l.pointerup(e)),
			on(canvas, 'pointerleave', () => l.pointerleave())
		];
		return () => {
			for (const off of offs) off();
			l.dispose();
			ladder = null;
		};
	}
</script>

<svelte:head>
	<title>Sleepers · zoom ladder mockup</title>
</svelte:head>

<main>
	<EngineHost {pixelSize} {setup} />
	<div
		class="flash"
		{@attach (el: HTMLDivElement) => {
			flashEl = el;
			return () => (flashEl = undefined);
		}}
	></div>

	<ViewInfo
		eyebrow="Sleepers · zoom ladder mockup"
		{level}
		name={INFO[level].name}
		description={INFO[level].desc}
		{address}
		{pixelSize}
		onpixelsize={setPixelSize}
	/>

	<ZoomLadder current={level} {navOpen} names={NAMES} onpick={(n) => ladder?.setLevel(n)} />

	<div class="hint card">
		{#if level === 1}
			<b>Click</b> the floor to walk · <b>Q / E</b> rotate · <b>Scroll</b> or <b>1–6</b> to zoom
		{:else}
			<b>Drag</b> to look around · <b>Scroll</b> or <b>1–6</b> to zoom
		{/if}
	</div>

	<div class="toast card" role="status" hidden={toast === null}>{toast}</div>
</main>

<style>
	main {
		position: fixed;
		inset: 0;
		background: #05070d;
		color: #cdd6e8;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		overflow: hidden;
		color-scheme: dark;
	}

	.flash {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0;
		background: radial-gradient(
			circle at 50% 50%,
			rgba(170, 205, 255, 0.5),
			rgba(5, 7, 13, 0.96) 68%
		);
	}

	.card {
		background: rgba(9, 13, 23, 0.84);
		border: 1px solid #26314a;
		border-radius: 2px;
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
	}

	.hint {
		position: absolute;
		left: calc(16px + env(safe-area-inset-left, 0px));
		bottom: calc(16px + env(safe-area-inset-bottom, 0px));
		padding: 8px 12px;
		font:
			400 11.5px/1.4 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #7c89a2;
	}

	.hint b {
		color: #cdd6e8;
		font-weight: 500;
	}

	.toast {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(72px + env(safe-area-inset-bottom, 0px));
		max-width: calc(100% - 32px);
		padding: 9px 14px;
		font:
			500 12.5px/1.4 'IBM Plex Sans',
			system-ui,
			sans-serif;
		color: #cdd6e8;
		border-color: rgba(111, 214, 208, 0.5);
	}

	.toast[hidden] {
		display: none;
	}

	@media (max-width: 720px) {
		.hint {
			display: none;
		}

		.toast {
			bottom: calc(84px + env(safe-area-inset-bottom, 0px));
		}
	}
</style>
