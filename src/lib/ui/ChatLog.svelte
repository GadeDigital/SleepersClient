<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import type { ChatEntry } from '$lib/net/game-state.svelte';
	import { SpeechMode } from '$lib/proto/sleepers/v1/world_pb';
	import { layout, visibleRange } from './virtual';

	interface Props {
		entries: ChatEntry[];
	}

	let { entries }: Props = $props();

	/** Height of a row before it has been measured. */
	const ESTIMATE = 22;
	/** Extra rows rendered above and below the viewport. */
	const OVERSCAN = 6;

	/** Measured row heights, by entry seq. */
	const heights = new SvelteMap<number, number>();
	let scrollTop = $state(0);
	let viewportHeight = $state(0);
	/** Whether to follow new lines: true until the reader scrolls up. */
	let atBottom = $state(true);

	const rows = $derived(layout(entries.length, (i) => heights.get(entries[i].seq), ESTIMATE));
	const range = $derived(visibleRange(rows, scrollTop, viewportHeight, OVERSCAN));
	const visible = $derived(entries.slice(range[0], range[1]));

	/**
	 * Measures a row whenever its size changes, and forgets the heights of
	 * lines that have dropped out of the log.
	 */
	function measure(seq: number): Attachment<HTMLElement> {
		return (row) => {
			const observer = new ResizeObserver(() => {
				heights.set(seq, row.offsetHeight);
				if (heights.size > entries.length + OVERSCAN * 4) {
					const first = entries[0]?.seq ?? 0;
					for (const old of heights.keys()) if (old < first) heights.delete(old);
				}
			});
			observer.observe(row);
			return () => observer.disconnect();
		};
	}

	function onscroll(event: Event & { currentTarget: HTMLDivElement }) {
		const el = event.currentTarget;
		scrollTop = el.scrollTop;
		atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
	}

	/** Follows new lines while at the bottom: scrolls to the end as the log grows. */
	const follow: Attachment<HTMLDivElement> = (el) => {
		$effect(() => {
			const total = rows.total;
			if (atBottom) el.scrollTop = total;
		});
	};

	/** How a line was said, where it is not plain talk. */
	const VERBS: Partial<Record<SpeechMode, string>> = {
		[SpeechMode.WHISPER]: 'whispers',
		[SpeechMode.YELL]: 'yells'
	};

	function modeClass(mode: SpeechMode): string {
		if (mode === SpeechMode.WHISPER) return 'whisper';
		if (mode === SpeechMode.YELL) return 'yell';
		return 'talk';
	}
</script>

<div
	class="log"
	bind:clientHeight={viewportHeight}
	{@attach follow}
	{onscroll}
	role="log"
	aria-label="What you hear"
>
	<div class="space" style:height="{rows.total}px">
		{#each visible as entry, i (entry.seq)}
			<p
				class="row {modeClass(entry.mode)}"
				class:muffled={entry.muffled}
				class:own={entry.own}
				style:top="{rows.tops[range[0] + i]}px"
				{@attach measure(entry.seq)}
			>
				<span class="who">
					<span class="speaker">{entry.speaker}</span>
					{#if VERBS[entry.mode]}<span class="how">{VERBS[entry.mode]}</span>{/if}
				</span>
				<span class="text">{entry.text}</span>
			</p>
		{/each}
	</div>
</div>

<style>
	.log {
		height: 12rem;
		overflow-y: auto;
		background: rgb(14 15 20 / 0.7);
		border-radius: 0.25rem;
		font-size: 0.9rem;
		overscroll-behavior: contain;
	}

	.space {
		position: relative;
	}

	.row {
		position: absolute;
		left: 0;
		right: 0;
		margin: 0;
		padding: 0.1rem 0.5rem;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.speaker {
		font-weight: 600;
		color: #9fb4d9;
	}

	.own .speaker {
		color: #f2f2f2;
	}

	/* Spacing comes from the flex gap and margins, not markup whitespace
	   (which flex layout ignores), so formatting the markup can never run
	   "Ana" and "yells" together or put a space before the colon. */
	.who {
		display: inline-flex;
		gap: 0.3em;
		align-items: baseline;
	}

	.who > :last-child::after {
		content: ':';
	}

	.how {
		font-size: 0.85em;
		opacity: 0.6;
	}

	.text {
		margin-left: 0.3em;
	}

	.whisper .text {
		font-style: italic;
		opacity: 0.8;
	}

	.yell .text {
		font-weight: 700;
	}

	.muffled .text {
		font-style: italic;
		color: #8a8d99;
	}
</style>
