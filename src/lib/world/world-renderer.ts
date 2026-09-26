import { Container, Graphics, type Application } from 'pixi.js';
import type { GameState } from '$lib/net/game-state.svelte';
import { Tile, type Room } from '$lib/proto/glyph/v1/world_pb';

/**
 * Size of one tile in art pixels. A placeholder until the art size is agreed
 * with the artist (see open questions in the architecture doc).
 */
export const TILE_SIZE = 16;

/** Placeholder zoom: screen pixels per art pixel. */
const ZOOM = 3;

const FLOOR = 0x2a2d3a;
const FLOOR_EDGE = 0x24262f;
const WALL = 0x6b6f80;
const UNKNOWN = 0xff00ff;

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

	constructor(app: Application, game: GameState) {
		this.#app = app;
		this.#game = game;
		this.#world.addChild(this.#tiles);
		app.stage.addChild(this.#world);
		app.ticker.add(this.#frame);
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
		this.#world.destroy({ children: true });
	}

	#frame = (): void => {
		// Until the camera follows a character, centre the room.
		const room = this.#game.room;
		const w = (room?.width ?? 0) * TILE_SIZE * ZOOM;
		const h = (room?.height ?? 0) * TILE_SIZE * ZOOM;
		this.#world.scale.set(ZOOM);
		this.#world.position.set(
			Math.round((this.#app.screen.width - w) / 2),
			Math.round((this.#app.screen.height - h) / 2)
		);
	};
}
