import { Container, Graphics, Text } from 'pixi.js';
import { isUnconscious, type CharacterView } from '$lib/net/game-state.svelte';
import { TILE_SIZE } from './scale';

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

/**
 * One character's placeholder: a coloured body in the world layer, and its
 * name in the unscaled label layer so the text stays sharp at any zoom.
 */
export class CharacterSprite {
	readonly body = new Graphics();
	readonly label: Text;
	/** The state the body was last drawn for, to redraw only on change. */
	#drawn: { unconscious: boolean; isYou: boolean } | null = null;
	/** Top of the body in art pixels within its tile; the name sits above it. */
	#top = 0;

	constructor(c: CharacterView, bodies: Container, labels: Container) {
		bodies.addChild(this.body);
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
	}

	/** Draws the body for the character's state; cheap when nothing changed. */
	draw(c: CharacterView, isYou: boolean): void {
		const unconscious = isUnconscious(c);
		if (this.#drawn?.unconscious === unconscious && this.#drawn.isYou === isYou) return;
		this.#drawn = { unconscious, isYou };

		const colour = COLOURS[c.id % COLOURS.length];
		const w = unconscious ? LYING_W : BODY_W;
		const h = unconscious ? LYING_H : BODY_H;
		const x = Math.floor((TILE_SIZE - w) / 2);
		this.#top = TILE_SIZE - h - 1;
		this.body
			.clear()
			.rect(x, this.#top, w, h)
			.fill(isYou ? YOU : OUTLINE)
			.rect(x + 1, this.#top + 1, w - 2, h - 2)
			.fill({ color: colour, alpha: unconscious ? LYING_ALPHA : 1 });
		// Bodies lie under anyone standing on the same tile (they do not block, ADR 023).
		this.body.zIndex = unconscious ? 0 : 1;
		this.label.alpha = unconscious ? LYING_LABEL_ALPHA : 1;
	}

	/**
	 * Places the character at art-pixel position (x, y) in the world.
	 * `origin` is where the world's (0, 0) is on screen and `zoom` is physical
	 * pixels per art pixel; `fontSize` is in physical pixels.
	 */
	place(x: number, y: number, origin: { x: number; y: number }, zoom: number, fontSize: number) {
		this.body.position.set(x, y);
		if (this.label.style.fontSize !== fontSize) this.label.style.fontSize = fontSize;
		this.label.position.set(
			Math.round(origin.x + (x + TILE_SIZE / 2) * zoom),
			Math.round(origin.y + (y + this.#top - 1) * zoom)
		);
	}

	destroy(): void {
		this.body.destroy();
		this.label.destroy();
	}
}
