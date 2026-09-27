<script lang="ts">
	import type { SpeechMode } from '$lib/proto/sleepers/v1/world_pb';
	import { MAX_LENGTH, MAX_WAITING, MODE_NAMES, MODES, parsePrefix } from './speech';

	interface Props {
		/** Lines sent but not yet spoken; they wait for the voice budget. */
		waiting: number;
		onsay: (mode: SpeechMode, text: string) => void;
	}

	let { waiting, onsay }: Props = $props();

	let mode = $state<(typeof MODES)[number]>(MODES[1]);
	let text = $state('');
	let input = $state<HTMLInputElement>();

	// A leading /w, /t or /y picks the mode for this line.
	const parsed = $derived(parsePrefix(text));
	const lineMode = $derived(parsed.mode ?? mode);
	const line = $derived(parsed.rest.trim());
	const max = $derived(MAX_LENGTH[lineMode]);
	const full = $derived(waiting >= MAX_WAITING);
	const canSend = $derived(line.length > 0 && [...line].length <= max && !full);

	function send() {
		if (!canSend) return;
		onsay(lineMode, line);
		text = '';
		input?.blur();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (line) send();
			else input?.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			input?.blur();
		} else if (event.key === 'Tab') {
			event.preventDefault();
			const step = event.shiftKey ? MODES.length - 1 : 1;
			mode = MODES[(MODES.indexOf(mode) + step) % MODES.length];
		}
	}

	// Enter anywhere else opens the input, as in most games.
	function onwindowkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.target instanceof HTMLInputElement) return;
		event.preventDefault();
		input?.focus();
	}
</script>

<svelte:window onkeydown={onwindowkeydown} />

<div class="chat-input">
	<div class="modes" role="group" aria-label="How to say it">
		{#each MODES as m (m)}
			<button
				type="button"
				class:active={lineMode === m}
				aria-pressed={lineMode === m}
				onclick={() => {
					mode = m;
					input?.focus();
				}}>{MODE_NAMES[m]}</button
			>
		{/each}
	</div>
	<input
		bind:this={input}
		bind:value={text}
		{onkeydown}
		placeholder="Press Enter to speak"
		aria-label="Say something"
		autocomplete="off"
		spellcheck="false"
	/>
	<span class="count" class:over={[...line].length > max}>{[...line].length}/{max}</span>
	{#if waiting > 0}
		<span class="waiting" role="status">
			{full ? 'Catching your breath…' : `${waiting} waiting…`}
		</span>
	{/if}
</div>

<style>
	.chat-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgb(14 15 20 / 0.85);
		border-radius: 0.25rem;
		font-size: 0.9rem;
	}

	.modes {
		display: flex;
	}

	button,
	input {
		font: inherit;
		color: inherit;
		background: #1c1e27;
		border: 1px solid #3a3d4b;
		padding: 0.3rem 0.5rem;
	}

	button.active {
		background: #3a3d4b;
		border-color: #6b6f80;
	}

	input {
		flex: 1;
		min-width: 0;
	}

	.count {
		font-size: 0.75rem;
		opacity: 0.5;
		font-variant-numeric: tabular-nums;
	}

	.count.over {
		color: #ff8a80;
		opacity: 1;
	}

	.waiting {
		font-size: 0.75rem;
		font-style: italic;
		opacity: 0.7;
		white-space: nowrap;
	}
</style>
