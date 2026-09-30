<script lang="ts">
	import { PIXEL_SIZES, type PixelSize } from '$lib/render/pixel';

	interface Props {
		value: PixelSize;
		onchange: (size: PixelSize) => void;
	}

	let { value, onchange }: Props = $props();
</script>

<div class="pxrow" role="group" aria-label="Pixel size">
	<span>Pixel size</span>
	{#each PIXEL_SIZES as size (size)}
		<button type="button" aria-pressed={size === value} onclick={() => onchange(size)}>
			{size === 1 ? 'Off' : `${size}×`}
		</button>
	{/each}
</div>

<style>
	.pxrow {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	span {
		font:
			500 10.5px/1 'IBM Plex Mono',
			ui-monospace,
			monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #7c89a2;
		margin-right: auto;
	}

	button {
		font:
			500 11px/1 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #7c89a2;
		background: transparent;
		border: 1px solid #26314a;
		padding: 5px 8px;
		border-radius: 2px;
		cursor: pointer;
	}

	button[aria-pressed='true'] {
		color: #f2a93b;
		border-color: #f2a93b;
		background: rgba(242, 169, 59, 0.14);
	}

	button:focus-visible {
		outline: 2px solid #6fd6d0;
		outline-offset: 2px;
	}
</style>
