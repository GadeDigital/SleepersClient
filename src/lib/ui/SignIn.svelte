<script lang="ts">
	interface Props {
		/** Whether the player is signed in; null while that is being checked. */
		signedIn: boolean | null;
		onsignin: () => void;
		onsignout: () => void;
	}

	let { signedIn, onsignin, onsignout }: Props = $props();
</script>

<section class="sign-in" aria-label="Your account">
	{#if signedIn === null}
		<p>Checking whether you are signed in…</p>
	{:else if signedIn}
		<p>You are signed in.</p>
		<button type="button" class="link" onclick={onsignout}>Sign out</button>
	{:else}
		<button type="button" class="primary" onclick={onsignin}>Sign in</button>
		<p class="note">You choose how on the next page: email, Discord, …</p>
	{/if}
</section>

<style>
	.sign-in {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	p {
		margin: 0;
	}

	button {
		font: inherit;
		color: inherit;
		cursor: pointer;
	}

	.primary {
		padding: 0.5rem 1.5rem;
		background: #3a3d4b;
		border: 1px solid #6b6f80;
		border-radius: 0.25rem;
	}

	.link {
		padding: 0;
		background: none;
		border: none;
		text-decoration: underline;
		opacity: 0.8;
	}

	.note {
		font-size: 0.8rem;
		opacity: 0.6;
	}
</style>
