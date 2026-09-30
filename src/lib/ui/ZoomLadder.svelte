<script lang="ts">
	interface Props {
		current: number;
		/** Whether zooms 3 to 6 are open (at the nav station). */
		navOpen: boolean;
		names: Readonly<Record<number, string>>;
		onpick: (level: number) => void;
	}

	let { current, navOpen, names, onpick }: Props = $props();

	const RUNGS = [6, 5, 4, 3, 2, 1];

	function tag(level: number): string {
		if (level <= 2) return 'Everyone';
		return navOpen ? 'Nav station · open' : 'Nav station · locked';
	}
</script>

<nav aria-label="Zoom levels">
	{#each RUNGS as level (level)}
		<button
			type="button"
			class="rung"
			class:active={level === current}
			class:locked={level >= 3 && !navOpen}
			class:navok={level >= 3 && navOpen}
			aria-current={level === current ? 'true' : 'false'}
			onclick={() => onpick(level)}
		>
			<span class="n">{level}</span>
			<span class="name">{names[level]}</span>
			<span class="tag">{tag(level)}</span>
		</button>
	{/each}
	<div class="note">
		{navOpen
			? 'You are at the nav station.'
			: 'Zooms 3–6 open at the nav station. Pick one and you walk there.'}
	</div>
</nav>

<style>
	nav {
		position: absolute;
		right: calc(16px + env(safe-area-inset-right, 0px));
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.rung {
		display: grid;
		grid-template-columns: 24px 1fr;
		align-items: center;
		column-gap: 10px;
		row-gap: 2px;
		min-width: 176px;
		padding: 9px 12px;
		text-align: left;
		cursor: pointer;
		background: rgba(9, 13, 23, 0.84);
		border: 1px solid #26314a;
		border-radius: 2px;
		color: #cdd6e8;
		font:
			500 13px/1.2 'IBM Plex Sans',
			system-ui,
			sans-serif;
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
	}

	.n {
		grid-row: span 2;
		font:
			400 15px/1 'Silkscreen',
			'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #7c89a2;
	}

	.tag {
		font:
			400 10px/1.2 'IBM Plex Mono',
			ui-monospace,
			monospace;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #7c89a2;
	}

	.rung:hover {
		border-color: #3a4868;
	}

	.rung.active {
		border-color: #f2a93b;
		background: rgba(40, 28, 10, 0.86);
	}

	.rung.active .n {
		color: #f2a93b;
	}

	.rung.locked .tag {
		color: #d99a8f;
	}

	.rung.navok .tag {
		color: #6fd6d0;
	}

	.rung:focus-visible {
		outline: 2px solid #6fd6d0;
		outline-offset: 2px;
	}

	.note {
		font:
			400 10.5px/1.4 'IBM Plex Mono',
			ui-monospace,
			monospace;
		color: #7c89a2;
		padding: 2px 4px 0;
		max-width: 176px;
	}

	@media (max-width: 720px) {
		nav {
			top: auto;
			transform: none;
			left: calc(16px + env(safe-area-inset-left, 0px));
			right: calc(16px + env(safe-area-inset-right, 0px));
			bottom: calc(16px + env(safe-area-inset-bottom, 0px));
			flex-direction: row-reverse;
			gap: 4px;
		}

		.rung {
			min-width: 0;
			flex: 1 1 0;
			grid-template-columns: 1fr;
			justify-items: center;
			padding: 7px 2px;
			text-align: center;
		}

		.n {
			grid-row: auto;
			font-size: 13px;
		}

		.name {
			font-size: 10px;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.tag,
		.note {
			display: none;
		}
	}
</style>
