import { Container, Graphics, TextureStyle, type Application } from 'pixi.js';
import type { GameState } from '$lib/net/game-state.svelte';
import { Tile, type Room } from '$lib/proto/glyph/v1/world_pb';
import { CharacterSprite } from './character-sprite';
import { glidePosition } from './glide';
import { queuedTarget } from './move-input';
import { TILE_SIZE, zoomFor } from './scale';

/** Name label size in CSS pixels. */
const LABEL_CSS_SIZE = 12;

const FLOOR = 0x2a2d3a;
const FLOOR_EDGE = 0x24262f;
const WALL = 0x6b6f80;
const UNKNOWN = 0xff00ff;
const QUEUED = 0xf2f2f2;

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
	/** Faint outline of the tile your queued step heads for. */
	readonly #queued = new Graphics();
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
		this.#queued
			.rect(0, 0, TILE_SIZE, TILE_SIZE)
			.stroke({ color: QUEUED, width: 1, alignment: 1, alpha: 0.35 });
		this.#queued.visible = false;
		this.#world.addChild(this.#tiles, this.#queued, this.#bodies);
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
		const tickNow = this.#game.clock.now(performance.now());
		this.#world.scale.set(this.#zoom);
		this.#followCamera(tickNow);
		this.#drawCharacters(tickNow);
		this.#drawQueued();
	};

	/**
	 * Centres the view on your own character, gliding with it. Before the
	 * snapshot names one, the room is centred instead. The world's offset is
	 * always a whole number of physical pixels.
	 */
	#followCamera(tickNow: number): void {
		const me = this.#game.me;
		let centreX: number;
		let centreY: number;
		if (me) {
			const [x, y] = glidePosition(me, tickNow);
			centreX = this.#snap(x * TILE_SIZE) + TILE_SIZE / 2;
			centreY = this.#snap(y * TILE_SIZE) + TILE_SIZE / 2;
		} else {
			const room = this.#game.room;
			centreX = ((room?.width ?? 0) * TILE_SIZE) / 2;
			centreY = ((room?.height ?? 0) * TILE_SIZE) / 2;
		}
		this.#world.position.set(
			Math.round(this.#app.screen.width / 2 - centreX * this.#zoom),
			Math.round(this.#app.screen.height / 2 - centreY * this.#zoom)
		);
	}

	/** Shows the move you sent while stepping, which the server holds as queued. */
	#drawQueued(): void {
		const me = this.#game.me;
		const dir = this.#game.pendingMove;
		this.#queued.visible = !!(me?.step && dir !== null);
		if (!me?.step || dir === null) return;
		const [x, y] = queuedTarget(me.step.toX, me.step.toY, dir);
		this.#queued.position.set(x * TILE_SIZE, y * TILE_SIZE);
	}

	/** Rounds an art-pixel coordinate to a whole physical pixel. */
	#snap(v: number): number {
		return Math.round(v * this.#zoom) / this.#zoom;
	}

	/** Keeps one sprite per character in view, gliding along any step. */
	#drawCharacters(tickNow: number): void {
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
			const [x, y] = glidePosition(c, tickNow);
			sprite.place(
				this.#snap(x * TILE_SIZE),
				this.#snap(y * TILE_SIZE),
				this.#world.position,
				this.#zoom,
				this.#fontSize
			);
		}
	}
}
