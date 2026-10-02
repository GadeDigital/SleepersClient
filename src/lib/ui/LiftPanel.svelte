<script lang="ts">
	import type { GameState } from '$lib/net/game-state.svelte';

	interface Props {
		game: GameState;
		/** Asks the lift to take you to a floor, by its index. */
		onlift: (floor: number) => void;
	}

	let { game, onlift }: Props = $props();

	/**
	 * The building you are in, while you stand in its lift (ADR 074). The
	 * server decides whether the lift goes; this only offers the floors.
	 */
	const building = $derived.by(() => {
		void game.chunksSeen; // the ground under you may arrive after you do
		const me = game.me;
		const b = game.map?.building;
		if (!me || !b?.hasLift) return null;
		return game.tileAt(me.x, me.y)?.tags.includes('lift') ? b : null;
	});

	/** "Going up…" or "Going down…" while the lift rides. */
	const riding = $derived.by(() => {
		const to = game.liftTo;
		const b = game.map?.building;
		if (to === null || !b) return null;
		return to > b.floor ? 'Going up…' : 'Going down…';
	});
</script>

{#if building || riding}
	<section class="lift" aria-label="Lift">
		{#if riding}
			<p class="riding" role="status">{riding}</p>
		{:else if building}
			<p class="name">{building.name} · lift</p>
			<div class="floors">
				<!-- Top floor first, as on a lift's panel. -->
				{#each building.floors.map((name, i) => ({ name, i })).reverse() as f (f.i)}
					<button
						type="button"
						disabled={f.i === building.floor}
						aria-current={f.i === building.floor ? 'true' : undefined}
						onclick={() => onlift(f.i)}
					>
						{f.name}
					</button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.lift {
		position: absolute;
		top: 1rem;
		right: 1rem;
		min-width: 12rem;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: rgba(9, 13, 23, 0.88);
		border: 1px solid #26314a;
		border-radius: 2px;
		font:
			400 12px/1.4 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #cdd6e8;
	}

	p {
		margin: 0;
	}

	.name {
		color: #7c89a2;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: 11px;
	}

	.riding {
		color: #4fd6d0;
	}

	.floors {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	button {
		padding: 5px 8px;
		background: #121a2b;
		border: 1px solid #26314a;
		color: #cdd6e8;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		border-color: #4fd6d0;
	}

	button:disabled {
		color: #4fd6d0;
		cursor: default;
	}
</style>
