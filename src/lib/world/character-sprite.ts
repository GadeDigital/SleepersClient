import { Container, Graphics, Text } from 'pixi.js';
import type { CharacterView } from '$lib/net/game-state.svelte';
import { TILE_SIZE } from './scale';

/** Placeholder body colours, picked by character id. */
const COLOURS = [0xe0a458, 0x5fb4a2, 0xc9656f, 0x7f8fd6, 0xb8c46a, 0xc58ad6, 0x6fb7d9, 0xd9926f];
const OUTLINE = 0x0e0f14;
const YOU = 0xf2f2f2;

/** Body size in art pixels, centred on the tile's bottom half. */
const BODY_W = 10;
const BODY_H = 13;

/**
 * One character's placeholder: a coloured body in the world layer, and its
 * name in the unscaled label layer so the text stays sharp at any zoom.
 */
export class CharacterSprite {
	readonly body = new Graphics();
	readonly label: Text;

	constructor(c: CharacterView, isYou: boolean, bodies: Container, labels: Container) {
		const colour = COLOURS[c.id % COLOURS.length];
		const x = (TILE_SIZE - BODY_W) / 2;
		const y = TILE_SIZE - BODY_H - 1;
		this.body
			.rect(x, y, BODY_W, BODY_H)
			.fill(isYou ? YOU : OUTLINE)
			.rect(x + 1, y + 1, BODY_W - 2, BODY_H - 2)
			.fill(colour);
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
			Math.round(origin.y + (y + TILE_SIZE - BODY_H - 2) * zoom)
		);
	}

	destroy(): void {
		this.body.destroy();
		this.label.destroy();
	}
}
