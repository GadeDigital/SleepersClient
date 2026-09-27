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
	<h2>Development login</h2>
	<label for="name">Your name</label>
	<input id="name" bind:value={name} maxlength="32" autocomplete="off" disabled={busy} />
	<button type="submit" disabled={!trimmed || busy}>{busy ? 'Joining…' : 'Join'}</button>
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	<p class="note">
		DEVELOPMENT ONLY: the name is your whole identity, with no password. The server must run with
		-dev-tools.
	</p>
</form>

<style>
	.prompt {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	h2 {
		margin: 0;
		font-size: 1rem;
		color: #e0a458;
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
