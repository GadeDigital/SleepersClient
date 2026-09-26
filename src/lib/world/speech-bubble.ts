import { Container, Graphics, Text } from 'pixi.js';
import type { ChatEntry } from '$lib/net/game-state.svelte';
import { SpeechMode } from '$lib/proto/glyph/v1/world_pb';

const BACKGROUND = 0x0e0f14;
const TEXT = 0xf2f2f2;
const MUFFLED = 0x8a8d99;

/** How long a line stays over its speaker: longer lines stay longer. */
export function bubbleDuration(text: string): number {
	return Math.min(8000, 3000 + 60 * [...text].length);
}

/**
 * The latest line a character said, shown above their name for a while. It
 * lives in the unscaled label layer, in physical pixels, so it stays sharp.
 */
export class SpeechBubble {
	readonly #view = new Container();
	readonly #background = new Graphics();
	readonly #text = new Text({
		text: '',
		style: { fontFamily: 'system-ui, sans-serif', fill: TEXT, wordWrap: true, align: 'center' }
	});
	/** When the bubble disappears, in performance.now() milliseconds. */
	#until = 0;
	/** The font size the background was last drawn for; 0 forces a redraw. */
	#drawnFor = 0;

	constructor(layer: Container) {
		this.#text.anchor.set(0.5, 1);
		this.#view.addChild(this.#background, this.#text);
		this.#view.visible = false;
		layer.addChild(this.#view);
	}

	/** Shows a line, styled the way the chat panel styles it. */
	show(entry: ChatEntry, nowMs: number): void {
		const style = this.#text.style;
		this.#text.text = entry.text;
		style.fill = entry.muffled ? MUFFLED : TEXT;
		style.fontStyle = entry.muffled || entry.mode === SpeechMode.WHISPER ? 'italic' : 'normal';
		style.fontWeight = entry.mode === SpeechMode.YELL ? 'bold' : 'normal';
		this.#until = nowMs + bubbleDuration(entry.text);
		// The newest line is drawn on top where bubbles overlap.
		this.#view.zIndex = entry.seq;
		this.#drawnFor = 0;
	}

	/**
	 * Places the bubble with its bottom centre at (x, bottom), in physical
	 * pixels, or hides it once its time is up.
	 */
	place(x: number, bottom: number, nowMs: number, fontSize: number): void {
		this.#view.visible = nowMs < this.#until;
		if (!this.#view.visible) return;
		if (this.#drawnFor !== fontSize) {
			this.#text.style.fontSize = fontSize;
			this.#text.style.wordWrapWidth = fontSize * 16;
			const pad = Math.round(fontSize * 0.4);
			const w = Math.ceil(this.#text.width) + pad * 2;
			const h = Math.ceil(this.#text.height) + pad;
			this.#text.position.set(0, -Math.round(pad / 2));
			this.#background
				.clear()
				.roundRect(-Math.round(w / 2), -h, w, h, pad)
				.fill({ color: BACKGROUND, alpha: 0.8 });
			this.#drawnFor = fontSize;
		}
		this.#view.position.set(Math.round(x), Math.round(bottom));
	}

	destroy(): void {
		this.#view.destroy({ children: true });
	}
}
