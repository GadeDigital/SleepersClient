<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Connection } from '$lib/net/connection.svelte';
	import ChatInput from '$lib/ui/ChatInput.svelte';
	import ChatLog from '$lib/ui/ChatLog.svelte';
	import DebugPanel from '$lib/ui/DebugPanel.svelte';
	import LiftPanel from '$lib/ui/LiftPanel.svelte';
	import NamePrompt from '$lib/ui/NamePrompt.svelte';
	import SignIn from '$lib/ui/SignIn.svelte';
	import CharacterSelect from '$lib/ui/CharacterSelect.svelte';
	import { createCharacter, fetchAccount } from '$lib/accounts/accounts';
	import type { Account, CharacterSummary } from '$lib/proto/sleepers/v1/accounts_pb';
	import { accessToken, signIn, signInConfigured, signOut } from '$lib/auth/auth';
	import WorldView from '$lib/world/WorldView.svelte';
	import { ActionKind, CharacterState } from '$lib/proto/sleepers/v1/world_pb';

	// Back from the game (left, kicked or disconnected): the characters'
	// states have changed, so the account is asked for again.
	const connection = new Connection(undefined, () => {
		if (signedIn) loadAccount();
	});

	onDestroy(() => connection.close());

	/** DEVELOPMENT ONLY: show the name-only login (ADR 047). */
	const devLogin = Boolean(import.meta.env.VITE_DEV_LOGIN);

	/** Why signing in or out failed, if it did. */
	let authError = $state<string | null>(null);
	const fail = (e: unknown) => (authError = e instanceof Error ? e.message : String(e));

	/** Whether the player is signed in; null while checking. */
	let signedIn = $state<boolean | null>(signInConfigured ? null : false);
	/** The signed-in player's account and characters. */
	let account = $state.raw<Account | null>(null);
	let busy = $state(false);

	/** A current access token, or null (and signed out) if there is none. */
	async function token(): Promise<string | null> {
		const t = await accessToken();
		if (t === null) signedIn = false;
		return t;
	}

	async function loadAccount() {
		const t = await token();
		if (t === null) return;
		try {
			account = await fetchAccount(t);
			authError = null;
		} catch (e) {
			fail(e);
		}
	}

	async function play(c: CharacterSummary) {
		const t = await token();
		if (t !== null) connection.join({ accessToken: t, characterId: c.id });
	}

	async function create(name: string) {
		busy = true;
		try {
			const t = await token();
			if (t !== null) {
				await createCharacter(t, name);
				await loadAccount();
			}
		} catch (e) {
			fail(e);
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		if (!signInConfigured) return;
		accessToken()
			.then((t) => {
				signedIn = t !== null;
				if (signedIn) loadAccount();
			})
			.catch((e) => {
				signedIn = false;
				fail(e);
			});
	});

	/** The action being aimed, for the prompt; null when walking. */
	let aiming = $state<ActionKind | null>(null);
	const AIM_PROMPTS: Partial<Record<ActionKind, string>> = {
		[ActionKind.BUILD_WALL]: 'Build a wall',
		[ActionKind.REMOVE_WALL]: 'Take down a wall'
	};
</script>

<svelte:head>
	<title>Sleepers</title>
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
	<LiftPanel game={connection.game} onlift={(floor) => connection.useLift(floor)} />
	<div class="hud">
		{#if aiming !== null}
			<p class="status aim" role="status">
				{AIM_PROMPTS[aiming]}: hold a direction and let go (Esc cancels)
			</p>
		{:else if connection.game.ghost}
			<p class="status ghost" role="status">
				Ghost: nobody sees or hears you, and you cannot speak or act. /ghost to return.
			</p>
		{:else if connection.game.me?.state === CharacterState.ASLEEP}
			<p class="status asleep" role="status">You are asleep. Move to get up.</p>
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
			onghost={() => connection.setGhost(!connection.game.ghost)}
		/>
	</div>
{:else}
	<main class="start">
		<h1>Sleepers</h1>
		{#if signInConfigured}
			{#if signedIn && account}
				<CharacterSelect
					{account}
					busy={busy || connection.status === 'connecting'}
					onplay={play}
					oncreate={create}
					onsignout={() => signOut().catch(fail)}
				/>
			{:else}
				<SignIn
					{signedIn}
					onsignin={() => signIn().catch(fail)}
					onsignout={() => signOut().catch(fail)}
				/>
			{/if}
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

	.status.ghost {
		color: #9fb4d9;
	}

	.status.asleep {
		color: #c58ad6;
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
