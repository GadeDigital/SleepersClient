<script lang="ts">
	interface Props {
		/** Called with the trimmed name when the player joins. */
		onjoin: (name: string) => void;
		busy?: boolean;
		error?: string | null;
	}

	let { onjoin, busy = false, error = null }: Props = $props();

	let name = $state('');
	const trimmed = $derived(name.trim());

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (trimmed && !busy) onjoin(trimmed);
	}
</script>

<form class="prompt" onsubmit={submit}>
	<h1>Glyph</h1>
	<label for="name">Your name</label>
	<!-- svelte-ignore a11y_autofocus -->
	<input id="name" bind:value={name} maxlength="32" autocomplete="off" autofocus disabled={busy} />
	<button type="submit" disabled={!trimmed || busy}>{busy ? 'Joining…' : 'Join'}</button>
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	<p class="note">Development login: the name is your whole identity, with no password.</p>
</form>

<style>
	.prompt {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: min(20rem, 100% - 2rem);
		margin: 20vh auto 0;
	}

	h1 {
		margin: 0 0 1rem;
		font-size: 2rem;
		letter-spacing: 0.1em;
	}

	input,
	button {
		font: inherit;
		padding: 0.5rem;
	}

	.error {
		color: #ff8a80;
		margin: 0;
	}

	.note {
		font-size: 0.8rem;
		opacity: 0.6;
	}
</style>
