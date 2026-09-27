<script lang="ts">
	import type { Account, CharacterSummary } from '$lib/proto/glyph/v1/accounts_pb';
	import { CharacterState } from '$lib/proto/glyph/v1/world_pb';

	interface Props {
		account: Account;
		/** Something is under way: joining, or making a character. */
		busy?: boolean;
		onplay: (character: CharacterSummary) => void;
		oncreate: (name: string) => void;
		onsignout: () => void;
	}

	let { account, busy = false, onplay, oncreate, onsignout }: Props = $props();

	let name = $state('');
	const used = $derived(account.characters.length);
	const full = $derived(used >= account.characterSlots);
	/** Another character of the account in the world stops the others joining. */
	const online = $derived(account.characters.find((c) => c.online));
	const tier = $derived(account.tier.charAt(0).toUpperCase() + account.tier.slice(1));

	function stateLabel(c: CharacterSummary): string {
		if (c.online) return 'Online';
		if (!c.hasPlayed) return 'New';
		switch (c.state) {
			case CharacterState.ASLEEP:
				return 'Asleep';
			case CharacterState.UNCONSCIOUS:
				return 'Unconscious';
			default:
				return 'Awake';
		}
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (name.trim() && !busy) oncreate(name.trim());
		name = '';
	}
</script>

<section class="select" aria-label="Your characters">
	<header>
		<p>
			{tier}: {used} of {account.characterSlots} character {account.characterSlots === 1
				? 'slot'
				: 'slots'} used
		</p>
		<button type="button" class="link" onclick={onsignout}>Sign out</button>
	</header>

	{#if account.characters.length > 0}
		<ul>
			{#each account.characters as c (c.id)}
				<li>
					<span class="name">{c.name}</span>
					<span class="state" class:online={c.online}>{stateLabel(c)}</span>
					<button
						type="button"
						disabled={busy || (online !== undefined && online.id !== c.id)}
						title={online && online.id !== c.id
							? `${online.name} is still in the world`
							: c.online
								? 'Play here: this window takes over'
								: ''}
						onclick={() => onplay(c)}>Play</button
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="note">You have no characters yet.</p>
	{/if}

	{#if online}
		<p class="note">
			{online.name} is still in the world; close their game before playing another character.
		</p>
	{/if}

	{#if full}
		<p class="note">
			{tier} accounts have {account.characterSlots} character {account.characterSlots === 1
				? 'slot'
				: 'slots'}.
		</p>
	{:else}
		<form onsubmit={submit}>
			<label for="new-name">New character</label>
			<input id="new-name" bind:value={name} maxlength="32" autocomplete="off" disabled={busy} />
			<button type="submit" disabled={!name.trim() || busy}>Create</button>
		</form>
	{/if}
</section>

<style>
	.select {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	p {
		margin: 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.4rem 0.6rem;
		background: #1c1e27;
		border-radius: 0.25rem;
	}

	.name {
		flex: 1;
		font-weight: 600;
	}

	.state {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.state.online {
		color: #5fb4a2;
		opacity: 1;
	}

	form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	input {
		flex: 1;
		min-width: 0;
	}

	button,
	input {
		font: inherit;
		color: inherit;
		background: #1c1e27;
		border: 1px solid #3a3d4b;
		padding: 0.3rem 0.6rem;
	}

	button:not(:disabled) {
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
	}

	.link {
		padding: 0;
		background: none;
		border: none;
		text-decoration: underline;
		opacity: 0.8;
	}

	.note {
		font-size: 0.85rem;
		opacity: 0.7;
	}
</style>
