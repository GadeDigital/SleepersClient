import { SpeechMode } from '$lib/proto/sleepers/v1/world_pb';

/** The modes in the order the chat input cycles through them. */
export const MODES = [SpeechMode.WHISPER, SpeechMode.TALK, SpeechMode.YELL] as const;

export const MODE_NAMES: Record<(typeof MODES)[number], string> = {
	[SpeechMode.WHISPER]: 'Whisper',
	[SpeechMode.TALK]: 'Talk',
	[SpeechMode.YELL]: 'Yell'
};

/**
 * Longest line per mode, mirroring the server (ADR 029) so the input never
 * offers to send what the server would refuse. The server still decides.
 */
export const MAX_LENGTH: Record<(typeof MODES)[number], number> = {
	[SpeechMode.WHISPER]: 190,
	[SpeechMode.TALK]: 190,
	[SpeechMode.YELL]: 95
};

/** Lines that may wait for the voice budget at once (ADR 029). */
export const MAX_WAITING = 3;

const PREFIXES: Record<string, (typeof MODES)[number]> = {
	'/w': SpeechMode.WHISPER,
	'/t': SpeechMode.TALK,
	'/y': SpeechMode.YELL
};

/** Reads a leading /w, /t or /y shortcut: the mode it picks and the rest. */
export function parsePrefix(text: string): { mode: (typeof MODES)[number] | null; rest: string } {
	const match = /^(\/[wty])(\s+|$)/.exec(text);
	if (!match) return { mode: null, rest: text };
	return { mode: PREFIXES[match[1]], rest: text.slice(match[0].length) };
}

/** How long a line stays over its speaker: longer lines stay longer. */
export function bubbleDuration(text: string): number {
	return Math.min(8000, 3000 + 60 * [...text].length);
}
