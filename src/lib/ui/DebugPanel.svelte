<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { GameState } from '$lib/net/game-state.svelte';

	// The development tools: the map overview and teleport, for admins only
	// (ADR 077). The snapshot says whether to offer them; the server checks
	// the role again on every request.

	interface Props {
		game: GameState;
		onteleport: (x: number, y: number) => void;
		onoverview: () => void;
	}

	let { game, onteleport, onoverview }: Props = $props();

	/** CSS pixels per overview cell, so the overview fits about 320 px. */
	const cell = $derived(
		game.overview ? Math.max(1, Math.min(3, Math.floor(320 / game.overview.width))) : 3
	);
	/** Tiles per overview cell: a chunk on a planet, a tile on an authored map. */
	const cellTiles = $derived(game.overview?.cellTiles ?? 32);

	let open = $state(false);
	let targetX = $state(0);
	let targetY = $state(0);

	const chunkSize = $derived(game.map?.chunkSize ?? 32);
	const me = $derived(game.me);

	function toggle() {
		open = !open;
		if (open && me) {
			targetX = me.x;
			targetY = me.y;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		// For anyone but an admin, F2 does nothing at all (ADR 077).
		if (event.key !== 'F2' || event.target instanceof HTMLInputElement || !game.devTools) return;
		event.preventDefault();
		toggle();
	}

	// The overview is of the map you are on; after stairs or a lift, ask again.
	$effect(() => {
		if (open && game.devTools && !game.overview) onoverview();
	});

	/** Paints the overview whenever it or the tile colours change. */
	const paint: Attachment<HTMLCanvasElement> = (canvas) => {
		$effect(() => {
			const overview = game.overview;
			const ctx = canvas.getContext('2d');
			if (!overview || !ctx) return;
			const image = ctx.createImageData(overview.width, overview.height);
			overview.cells.forEach((id, i) => {
				const colour = game.tileTypes.get(id)?.colour ?? 0xff00ff;
				image.data.set([colour >> 16, (colour >> 8) & 0xff, colour & 0xff, 255], i * 4);
			});
			ctx.putImageData(image, 0, 0);
		});
	};

	/** Teleports to the middle of the cell clicked on. */
	function onclick(event: MouseEvent & { currentTarget: HTMLCanvasElement }) {
		const cx = Math.floor(event.offsetX / cell);
		const cy = Math.floor(event.offsetY / cell);
		onteleport(
			cx * cellTiles + Math.floor(cellTiles / 2),
			cy * cellTiles + Math.floor(cellTiles / 2)
		);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onteleport(Math.round(targetX), Math.round(targetY));
	}
</script>

<svelte:window {onkeydown} />

{#if open && game.devTools}
	<section class="debug" aria-label="Development tools">
		<header>
			<strong>DEVELOPMENT ONLY</strong>
			<button type="button" onclick={toggle} aria-label="Close">×</button>
		</header>
		{#if me}
			<p>
				You are at {me.x}, {me.y} (chunk {Math.floor(me.x / chunkSize)}, {Math.floor(
					me.y / chunkSize
				)})
			</p>
		{/if}
		{#if game.overview}
			<div class="overview">
				<canvas
					width={game.overview.width}
					height={game.overview.height}
					style:width="{game.overview.width * cell}px"
					style:height="{game.overview.height * cell}px"
					{@attach paint}
					{onclick}
					title="Click to teleport there"
				></canvas>
				{#if me}
					<span
						class="you"
						style:left="{Math.floor(me.x / cellTiles) * cell}px"
						style:top="{Math.floor(me.y / cellTiles) * cell}px"
						style:width="{cell}px"
						style:height="{cell}px"
					></span>
				{/if}
			</div>
			<p class="hint">Overview of this map, fog of war ignored.</p>
		{:else}
			<p>Waiting for the overview…</p>
		{/if}
		<form onsubmit={submit}>
			<label>x <input type="number" bind:value={targetX} /></label>
			<label>y <input type="number" bind:value={targetY} /></label>
			<button type="submit">Teleport</button>
		</form>
		{#if game.rejection}
			<p class="rejection" role="status">{game.rejection}</p>
		{/if}
	</section>
{/if}

<style>
	.debug {
		position: absolute;
		top: 1rem;
		right: 1rem;
		max-width: calc(100% - 2rem);
		padding: 0.75rem;
		background: rgb(14 15 20 / 0.92);
		border: 2px dashed #e0a458;
		border-radius: 0.25rem;
		font-size: 0.85rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #e0a458;
		letter-spacing: 0.05em;
	}

	header button {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		font-size: 1.2rem;
		cursor: pointer;
	}

	p {
		margin: 0.4rem 0;
	}

	.overview {
		position: relative;
		overflow: auto;
		max-width: 100%;
	}

	canvas {
		display: block;
		image-rendering: pixelated;
		cursor: crosshair;
	}

	.you {
		position: absolute;
		outline: 2px solid #f2f2f2;
		pointer-events: none;
	}

	.hint {
		font-size: 0.75rem;
		opacity: 0.6;
	}

	form {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	input {
		width: 5rem;
		font: inherit;
		color: inherit;
		background: #1c1e27;
		border: 1px solid #3a3d4b;
	}

	form button {
		font: inherit;
		color: inherit;
		background: #3a3d4b;
		border: 1px solid #6b6f80;
		padding: 0.2rem 0.6rem;
	}

	.rejection {
		color: #ff8a80;
	}
</style>
