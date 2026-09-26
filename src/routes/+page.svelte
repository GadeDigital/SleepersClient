<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Connection } from '$lib/net/connection.svelte';
	import ChatInput from '$lib/ui/ChatInput.svelte';
	import ChatLog from '$lib/ui/ChatLog.svelte';
	import DebugPanel from '$lib/ui/DebugPanel.svelte';
	import NamePrompt from '$lib/ui/NamePrompt.svelte';
	import WorldView from '$lib/world/WorldView.svelte';
	import { ActionKind } from '$lib/proto/glyph/v1/world_pb';

	const connection = new Connection();

	onDestroy(() => connection.close());

	/** The action being aimed, for the prompt; null when walking. */
	let aiming = $state<ActionKind | null>(null);
	const AIM_PROMPTS: Partial<Record<ActionKind, string>> = {
		[ActionKind.DIG]: 'Dig',
		[ActionKind.BUILD_WALL]: 'Build a wall',
		[ActionKind.REMOVE_WALL]: 'Take down a wall'
	};
</script>

<svelte:head>
	<title>Glyph</title>
</svelte:head>

{#if connection.status === 'joined'}
	<WorldView
		game={connection.game}
		onmove={(direction) => connection.move(direction)}
		onact={(kind, direction) => connection.act(kind, direction)}
		onaiming={(kind) => (aiming = kind)}
	/>
	<DebugPanel
		game={connection.game}
		onteleport={(x, y) => connection.debugTeleport(x, y)}
		onoverview={() => connection.debugOverview()}
	/>
	<div class="hud">
		{#if aiming !== null}
			<p class="status aim" role="status">
				{AIM_PROMPTS[aiming]}: hold a direction and let go (Esc cancels)
			</p>
		{:else if connection.game.rejection}
			<!-- A new refusal re-creates the paragraph, restarting its fade. -->
			{#key connection.game.rejections}
				<p class="status fade" role="status">{connection.game.rejection}</p>
			{/key}
		{/if}
		<ChatLog entries={connection.game.log} />
		<ChatInput
			waiting={connection.game.unspoken.length}
			onsay={(mode, text) => connection.say(mode, text)}
		/>
	</div>
{:else}
	<NamePrompt
		onjoin={(name) => connection.join(name)}
		busy={connection.status === 'connecting'}
		error={connection.error}
	/>
{/if}

<style>
	.hud {
		position: absolute;
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		max-width: 40rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.status {
		align-self: flex-start;
		margin: 0;
		padding: 0.3rem 0.6rem;
		background: rgb(14 15 20 / 0.85);
		border-radius: 0.25rem;
		font-size: 0.85rem;
		color: #ff8a80;
	}

	.status.aim {
		color: #e0a458;
	}

	/* Shown for 4 s, then faded out and left invisible. */
	.status.fade {
		animation: fade 0.4s ease-in 3.6s forwards;
	}

	@keyframes fade {
		to {
			opacity: 0;
			visibility: hidden;
		}
	}
</style>
