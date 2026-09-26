<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Connection } from '$lib/net/connection.svelte';
	import ChatInput from '$lib/ui/ChatInput.svelte';
	import NamePrompt from '$lib/ui/NamePrompt.svelte';
	import WorldView from '$lib/world/WorldView.svelte';

	const connection = new Connection();

	onDestroy(() => connection.close());
</script>

<svelte:head>
	<title>Glyph</title>
</svelte:head>

{#if connection.status === 'joined'}
	<WorldView game={connection.game} onmove={(direction) => connection.move(direction)} />
	<div class="hud">
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
	}
</style>
