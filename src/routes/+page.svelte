<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Connection } from '$lib/net/connection.svelte';
	import NamePrompt from '$lib/ui/NamePrompt.svelte';

	const connection = new Connection();

	onDestroy(() => connection.close());
</script>

<svelte:head>
	<title>Glyph</title>
</svelte:head>

{#if connection.status === 'joined'}
	<p>Joined as {connection.game.me?.name}.</p>
{:else}
	<NamePrompt
		onjoin={(name) => connection.join(name)}
		busy={connection.status === 'connecting'}
		error={connection.error}
	/>
{/if}
