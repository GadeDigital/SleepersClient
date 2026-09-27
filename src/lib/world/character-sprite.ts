import { Container, Graphics, Text } from 'pixi.js';
import { isAsleep, isUnconscious, type CharacterView } from '$lib/net/game-state.svelte';
import { TILE_SIZE } from './scale';
import { SpeechBubble } from './speech-bubble';

/** Placeholder body colours, picked by character id. */
const COLOURS = [0xe0a458, 0x5fb4a2, 0xc9656f, 0x7f8fd6, 0xb8c46a, 0xc58ad6, 0x6fb7d9, 0xd9926f];
const OUTLINE = 0x0e0f14;
const YOU = 0xf2f2f2;

/** Standing body size in art pixels, at the bottom of the tile. */
const BODY_W = 10;
const BODY_H = 13;
/** An unconscious body lies on its side: wider, flat, and dim. */
const LYING_W = 13;
const LYING_H = 6;
const LYING_ALPHA = 0.45;
const LYING_LABEL_ALPHA = 0.5;
const ASLEEP_ALPHA = 0.75;
/** The action progress bar, in art pixels. */
const PROGRESS_W = 14;
const PROGRESS = 0xe0a458;

/**
 * One character's placeholder: a coloured body in the world layer, and its
 * name in the unscaled label layer so the text stays sharp at any zoom.
 */
export class CharacterSprite {
	readonly body = new Graphics();
	/** How far an action under way has got, drawn over the body. */
	readonly progress = new Graphics();
	readonly label: Text;
	/** The latest line the character said, above the name. */
	readonly bubble: SpeechBubble;
	/** The state the body was last drawn for, to redraw only on change. */
	#drawn: { unconscious: boolean; asleep: boolean; isYou: boolean } | null = null;
	#name: string;
	/** Top of the body in art pixels within its tile; the name sits above it. */
	#top = 0;
	/** The progress bar's filled width last drawn, in art pixels; -1 if hidden. */
	#progressDrawn = -1;

	constructor(c: CharacterView, bodies: Container, labels: Container) {
		bodies.addChild(this.body);
		this.progress.zIndex = 2; // over every body
		bodies.addChild(this.progress);
		this.#name = c.name;
		this.label = new Text({
			text: c.name,
			style: {
				fontFamily: 'system-ui, sans-serif',
				fill: 0xf2f2f2,
				stroke: { color: OUTLINE, width: 3 }
			}
		});
		this.label.anchor.set(0.5, 1);
		labels.addChild(this.label);
		this.bubble = new SpeechBubble(labels);
	}

	/** Draws the body for the character's state; cheap when nothing changed. */
	draw(c: CharacterView, isYou: boolean): void {
		const unconscious = isUnconscious(c);
		const asleep = isAsleep(c);
		const d = this.#drawn;
		if (d?.unconscious === unconscious && d.asleep === asleep && d.isYou === isYou) return;
		this.#drawn = { unconscious, asleep, isYou };
		// Sleepers lie down too, less dimmed than the unconscious, with a "z".
		const lying = unconscious || asleep;
		this.label.text = asleep ? `${this.#name} z` : this.#name;

		const colour = COLOURS[c.id % COLOURS.length];
		const w = lying ? LYING_W : BODY_W;
		const h = lying ? LYING_H : BODY_H;
		const x = Math.floor((TILE_SIZE - w) / 2);
		this.#top = TILE_SIZE - h - 1;
		this.body
			.clear()
			.rect(x, this.#top, w, h)
			.fill(isYou ? YOU : OUTLINE)
			.rect(x + 1, this.#top + 1, w - 2, h - 2)
			.fill({ color: colour, alpha: unconscious ? LYING_ALPHA : asleep ? ASLEEP_ALPHA : 1 });
		// Bodies lie under anyone standing on the same tile (they do not block, ADR 023).
		this.body.zIndex = lying ? 0 : 1;
		this.label.alpha = unconscious ? LYING_LABEL_ALPHA : 1;
	}

	/**
	 * Places the character at art-pixel position (x, y) in the world.
	 * `origin` is where the world's (0, 0) is on screen and `zoom` is physical
	 * pixels per art pixel; `fontSize` is in physical pixels. Any speech
	 * bubble sits just above the name.
	 */
	place(
		x: number,
		y: number,
		origin: { x: number; y: number },
		zoom: number,
		fontSize: number,
		nowMs: number
	) {
		this.body.position.set(x, y);
		this.progress.position.set(x, y);
		if (this.label.style.fontSize !== fontSize) this.label.style.fontSize = fontSize;
		this.label.position.set(
			Math.round(origin.x + (x + TILE_SIZE / 2) * zoom),
			Math.round(origin.y + (y + this.#top - 1) * zoom)
		);
		const gap = Math.round(fontSize * 0.3);
		this.bubble.place(this.label.x, this.label.y - this.label.height - gap, nowMs, fontSize);
	}

	/**
	 * Shows an action's progress, 0 to 1, as a bar just below the character's
	 * tile, clear of the name above; null hides it. Redrawn only when the bar
	 * grows by a whole art pixel.
	 */
	setProgress(fraction: number | null): void {
		const width =
			fraction === null ? -1 : Math.round(Math.min(1, Math.max(0, fraction)) * PROGRESS_W);
		if (width === this.#progressDrawn) return;
		this.#progressDrawn = width;
		this.progress.clear();
		if (width < 0) return;
		const x = (TILE_SIZE - PROGRESS_W) / 2;
		const y = TILE_SIZE + 1;
		this.progress.rect(x - 1, y - 1, PROGRESS_W + 2, 4).fill(OUTLINE);
		if (width > 0) this.progress.rect(x, y, width, 2).fill(PROGRESS);
	}

	destroy(): void {
		this.progress.destroy();
		this.body.destroy();
		this.label.destroy();
		this.bubble.destroy();
	}
}
