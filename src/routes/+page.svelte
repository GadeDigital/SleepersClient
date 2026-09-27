<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Connection } from '$lib/net/connection.svelte';
	import ChatInput from '$lib/ui/ChatInput.svelte';
	import ChatLog from '$lib/ui/ChatLog.svelte';
	import DebugPanel from '$lib/ui/DebugPanel.svelte';
	import NamePrompt from '$lib/ui/NamePrompt.svelte';
	import SignIn from '$lib/ui/SignIn.svelte';
	import { accessToken, signIn, signInConfigured, signOut } from '$lib/auth/auth';
	import WorldView from '$lib/world/WorldView.svelte';
	import { ActionKind } from '$lib/proto/glyph/v1/world_pb';

	const connection = new Connection();

	onDestroy(() => connection.close());

	/** DEVELOPMENT ONLY: show the name-only login (ADR 047). */
	const devLogin = Boolean(import.meta.env.VITE_DEV_LOGIN);

	/** Why signing in or out failed, if it did. */
	let authError = $state<string | null>(null);
	const fail = (e: unknown) => (authError = e instanceof Error ? e.message : String(e));

	/** Whether the player is signed in; null while checking. */
	let signedIn = $state<boolean | null>(signInConfigured ? null : false);
	onMount(() => {
		if (signInConfigured)
			accessToken()
				.then((token) => (signedIn = token !== null))
				.catch((e) => {
					signedIn = false;
					fail(e);
				});
	});

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
	<main class="start">
		<h1>Glyph</h1>
		{#if signInConfigured}
			<SignIn
				{signedIn}
				onsignin={() => signIn().catch(fail)}
				onsignout={() => signOut().catch(fail)}
			/>
			{#if authError}
				<p class="error" role="alert">Signing in failed: {authError}</p>
			{/if}
		{:else}
			<p class="note">Signing in is not set up: fill in the client's .env (see .env.example).</p>
		{/if}
		{#if connection.error}
			<p class="error" role="alert">{connection.error}</p>
		{/if}
		{#if devLogin}
			<NamePrompt
				onjoin={(name) => connection.join({ name })}
				busy={connection.status === 'connecting'}
			/>
		{/if}
	</main>
{/if}

<style>
	.start {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: min(24rem, 100% - 2rem);
		margin: 15vh auto 0;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		letter-spacing: 0.1em;
	}

	.note {
		margin: 0;
		opacity: 0.7;
	}

	.error {
		margin: 0;
		color: #ff8a80;
	}

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
