<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Connection } from '$lib/net/connection.svelte';
	import NamePrompt from '$lib/ui/NamePrompt.svelte';
	import WorldView from '$lib/world/WorldView.svelte';

	const connection = new Connection();

	onDestroy(() => connection.close());
</script>

<svelte:head>
	<title>Glyph</title>
</svelte:head>

{#if connection.status === 'joined'}
	<WorldView />
{:else}
	<NamePrompt
		onjoin={(name) => connection.join(name)}
		busy={connection.status === 'connecting'}
		error={connection.error}
	/>
{/if}
