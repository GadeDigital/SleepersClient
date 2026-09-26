import { Container, Graphics, TextureStyle, type Application } from 'pixi.js';
import type { GameState } from '$lib/net/game-state.svelte';
import { Tile, type Room } from '$lib/proto/glyph/v1/world_pb';
import { CharacterSprite } from './character-sprite';
import { TILE_SIZE, zoomFor } from './scale';

/** Name label size in CSS pixels. */
const LABEL_CSS_SIZE = 12;

const FLOOR = 0x2a2d3a;
const FLOOR_EDGE = 0x24262f;
const WALL = 0x6b6f80;
const UNKNOWN = 0xff00ff;

// Pixel art: sample textures nearest-neighbour, never smoothed.
TextureStyle.defaultOptions.scaleMode = 'nearest';

/**
 * Owns the Pixi scene for the world view. It draws what the game state holds
 * and never changes it (ADR 002). Pixi objects stay out of Svelte state: the
 * renderer reads the game state and updates its own display objects.
 */
export class WorldRenderer {
	readonly #app: Application;
	readonly #game: GameState;
	/** Everything in world coordinates, in art pixels; the camera moves and scales it. */
	readonly #world = new Container();
	readonly #tiles = new Graphics();
	readonly #bodies = new Container();
	/** Names, in unscaled physical pixels above the world. */
	readonly #labels = new Container();
	readonly #sprites = new Map<number, CharacterSprite>();
	/** Physical pixels per art pixel. */
	#zoom = 1;
	#fontSize = LABEL_CSS_SIZE;

	constructor(app: Application, game: GameState) {
		this.#app = app;
		this.#game = game;
		this.#world.addChild(this.#tiles, this.#bodies);
		app.stage.addChild(this.#world, this.#labels);
		app.ticker.add(this.#frame);
	}

	/**
	 * Sizes the canvas in physical pixels. The stage works in physical pixels
	 * too (renderer resolution 1), so whole-number positions and zoom land
	 * exactly on the screen's pixel grid.
	 */
	resize(width: number, height: number, devicePixelRatio: number): void {
		this.#app.renderer.resize(width, height);
		this.#zoom = zoomFor(devicePixelRatio);
		this.#fontSize = Math.round(LABEL_CSS_SIZE * devicePixelRatio);
	}

	/** Redraws the tile layer. Called when the snapshot brings a new room. */
	setRoom(room: Room | null): void {
		const g = this.#tiles.clear();
		if (!room) return;
		for (let y = 0; y < room.height; y++) {
			for (let x = 0; x < room.width; x++) {
				const tile = room.tiles[y * room.width + x];
				const px = x * TILE_SIZE;
				const py = y * TILE_SIZE;
				if (tile === Tile.FLOOR) {
					// A one-pixel darker edge makes single tiles visible.
					g.rect(px, py, TILE_SIZE, TILE_SIZE).fill(FLOOR_EDGE);
					g.rect(px + 1, py + 1, TILE_SIZE - 1, TILE_SIZE - 1).fill(FLOOR);
				} else {
					g.rect(px, py, TILE_SIZE, TILE_SIZE).fill(tile === Tile.WALL ? WALL : UNKNOWN);
				}
			}
		}
	}

	destroy(): void {
		this.#app.ticker.remove(this.#frame);
		this.#sprites.clear();
		this.#world.destroy({ children: true });
		this.#labels.destroy({ children: true });
	}

	#frame = (): void => {
		// Until the camera follows a character, centre the room.
		const room = this.#game.room;
		const w = (room?.width ?? 0) * TILE_SIZE * this.#zoom;
		const h = (room?.height ?? 0) * TILE_SIZE * this.#zoom;
		this.#world.scale.set(this.#zoom);
		this.#world.position.set(
			Math.round((this.#app.screen.width - w) / 2),
			Math.round((this.#app.screen.height - h) / 2)
		);
		this.#drawCharacters();
	};

	/** Keeps one sprite per character in view, at the tile the server gave. */
	#drawCharacters(): void {
		const characters = this.#game.characters;
		for (const [id, sprite] of this.#sprites) {
			if (!(id in characters)) {
				sprite.destroy();
				this.#sprites.delete(id);
			}
		}
		for (const c of Object.values(characters)) {
			let sprite = this.#sprites.get(c.id);
			if (!sprite) {
				sprite = new CharacterSprite(c, c.id === this.#game.myId, this.#bodies, this.#labels);
				this.#sprites.set(c.id, sprite);
			}
			sprite.place(
				c.x * TILE_SIZE,
				c.y * TILE_SIZE,
				this.#world.position,
				this.#zoom,
				this.#fontSize
			);
		}
	}
}
