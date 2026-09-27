<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { completeSignIn } from '$lib/auth/auth';

	let error = $state<string | null>(null);

	// The provider sends the player back here with a code; exchange it for
	// tokens, then go on to the character screen.
	onMount(() => {
		completeSignIn()
			.then(() => goto(resolve('/'), { replaceState: true }))
			.catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
	});
</script>

<svelte:head>
	<title>Signing in… · Sleepers</title>
</svelte:head>

<main>
	{#if error}
		<p role="alert">Signing in failed: {error}</p>
		<p><a href={resolve('/')}>Back to the start</a></p>
	{:else}
		<p>Signing in…</p>
	{/if}
</main>

<style>
	main {
		width: min(24rem, 100% - 2rem);
		margin: 20vh auto 0;
	}

	[role='alert'] {
		color: #ff8a80;
	}

	a {
		color: inherit;
	}
</style>
