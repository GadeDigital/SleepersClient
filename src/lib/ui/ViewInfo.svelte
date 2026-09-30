<script lang="ts">
	import type { PixelSize } from '$lib/render/pixel';
	import PixelSizeButtons from './PixelSizeButtons.svelte';

	interface Props {
		eyebrow: string;
		level: number;
		name: string;
		description: string;
		address: string;
		pixelSize: PixelSize;
		onpixelsize: (size: PixelSize) => void;
	}

	let { eyebrow, level, name, description, address, pixelSize, onpixelsize }: Props = $props();
</script>

<section class="card" aria-live="polite">
	<div class="eyebrow">{eyebrow}</div>
	<h1><span class="num">{level}</span>{name}</h1>
	<p>{description}</p>
	<div class="addr">{address}</div>
	<div class="px">
		<PixelSizeButtons value={pixelSize} onchange={onpixelsize} />
	</div>
</section>

<style>
	.card {
		position: absolute;
		top: calc(16px + env(safe-area-inset-top, 0px));
		left: calc(16px + env(safe-area-inset-left, 0px));
		/*
		 * 360 px of content, as in the reference, with padding and border on
		 * top; on narrow screens it shrinks so the whole card keeps its 16 px
		 * margins (the reference overflows there).
		 */
		width: min(360px, calc(100% - 32px - 34px));
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: rgba(9, 13, 23, 0.84);
		border: 1px solid #26314a;
		border-radius: 2px;
		-webkit-backdrop-filter: blur(6px);
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

	h1 {
		margin: 0;
		font:
			400 20px/1.1 'Silkscreen',
			'IBM Plex Mono',
			ui-monospace,
			monospace;
		letter-spacing: 0.03em;
		color: #cdd6e8;
		text-wrap: balance;
	}

	.num {
		color: #f2a93b;
		margin-right: 8px;
	}

	p {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: #cdd6e8;
	}

	.addr {
		font:
			400 11.5px/1.4 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #6fd6d0;
		font-variant-numeric: tabular-nums;
	}

	.px {
		border-top: 1px solid #26314a;
		margin-top: 2px;
		padding-top: 8px;
	}

	@media (max-width: 720px) {
		.card {
			padding: 12px 14px;
			gap: 6px;
		}

		h1 {
			font-size: 16px;
		}

		p {
			font-size: 12px;
		}
	}

	@media (max-width: 720px) and (max-height: 560px) {
		p {
			display: none;
		}
	}
</style>
