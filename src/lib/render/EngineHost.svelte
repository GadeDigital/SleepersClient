<script lang="ts">
	import { untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Engine } from './engine';
	import type { PixelSize } from './pixel';

	interface Props {
		pixelSize: PixelSize;
		/**
		 * Adds views to the engine once it exists; may return a cleanup that
		 * runs before the engine is disposed.
		 */
		setup: (engine: Engine) => void | (() => void);
	}

	let { pixelSize, setup }: Props = $props();

	/**
	 * Runs the engine on the host's canvas for as long as it is mounted.
	 * Three.js objects never go into Svelte state (ADR 051).
	 */
	const mount: Attachment<HTMLDivElement> = (host) => {
		const canvas = host.querySelector('canvas');
		const layer = host.querySelector<HTMLElement>('.labels');
		if (!canvas || !layer) return;
		const engine = new Engine(canvas, layer);
		const cleanup = untrack(() => setup)(engine);

		$effect(() => {
			engine.pixelSize = pixelSize;
		});

		// The host's exact size in physical pixels. Where the browser reports
		// device-pixel-content-box and it agrees with devicePixelRatio, use it;
		// otherwise work the size out from the CSS size.
		const observer = new ResizeObserver(([entry]) => {
			const dpr = window.devicePixelRatio;
			const width = entry.contentRect.width * dpr;
			const height = entry.contentRect.height * dpr;
			const box = entry.devicePixelContentBoxSize?.[0];
			const exact =
				box && Math.abs(box.inlineSize - width) <= 1 && Math.abs(box.blockSize - height) <= 1;
			if (exact) engine.resize(box.inlineSize, box.blockSize, dpr);
			else engine.resize(Math.round(width), Math.round(height), dpr);
		});
		try {
			observer.observe(host, { box: 'device-pixel-content-box' });
		} catch {
			observer.observe(host);
		}

		return () => {
			observer.disconnect();
			cleanup?.();
			engine.dispose();
		};
	};
</script>

<div class="host" {@attach mount}>
	<canvas></canvas>
	<div class="labels"></div>
</div>

<style>
	.host {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	canvas {
		position: absolute;
		left: 0;
		top: 0;
		display: block;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
		touch-action: none;
	}

	.labels {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}

	/* Label styles from the reference mockup (ADR 051). */
	.labels :global(.lbl) {
		position: absolute;
		left: 0;
		top: 0;
		white-space: nowrap;
		font:
			500 11px/1.3 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #cdd6e8;
		background: rgba(5, 7, 13, 0.78);
		border: 1px solid #26314a;
		padding: 2px 6px;
		will-change: transform;
	}

	.labels :global(.lbl.amber) {
		color: #f2a93b;
		border-color: rgba(242, 169, 59, 0.55);
	}

	.labels :global(.lbl.cyan) {
		color: #6fd6d0;
		border-color: rgba(111, 214, 208, 0.45);
	}

	.labels :global(.lbl.quiet) {
		color: #7c89a2;
	}
</style>
