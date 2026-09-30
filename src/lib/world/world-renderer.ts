import { Container, Graphics, TextureStyle, type Application } from 'pixi.js';
import type { GameState } from '$lib/net/game-state.svelte';
import { ActionKind, type Direction } from '$lib/proto/sleepers/v1/world_pb';
import { CharacterSprite } from './character-sprite';
import { drawChunk } from './chunk-layer';
import { DELTAS } from './directions';
import { glidePosition } from './glide';
import { queuedTarget } from './move-input';
import { TILE_SIZE, zoomFor } from './scale';
import { nearest } from './wrap';

/** Name label size in CSS pixels. */
const LABEL_CSS_SIZE = 12;

const QUEUED = 0xf2f2f2;

/** What the player is aiming: an action, and the direction held, if any. */
export interface Aim {
	kind: ActionKind;
	dir: Direction | null;
}

const AIM_COLOURS: Partial<Record<ActionKind, number>> = {
	[ActionKind.BUILD_WALL]: 0x7f8fd6,
	[ActionKind.REMOVE_WALL]: 0xc9656f
};

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
	/** The ground: one layer per chunk held, by chunk key. */
	readonly #ground = new Container();
	readonly #chunkLayers = new Map<string, { layer: Graphics; version: number }>();
	/** While aiming an action: the 8 neighbouring tiles, the aimed one bright. */
	readonly #aim = new Graphics();
	readonly #aiming: () => Aim | null;
	/** The camera's centre column in tiles; may lie past the seam while gliding. */
	#camX = 0;
	/** Faint outline of the tile your queued step heads for. */
	readonly #queued = new Graphics();
	readonly #bodies = new Container({ sortableChildren: true });
	/** Names, in unscaled physical pixels above the world. */
	readonly #labels = new Container({ sortableChildren: true });
	readonly #sprites = new Map<number, CharacterSprite>();
	/** The last chat log line already shown as a speech bubble. */
	#seenSeq = 0;
	/** Physical pixels per art pixel. */
	#zoom = 1;
	#fontSize = LABEL_CSS_SIZE;

	/**
	 * aiming tells the renderer what action the player is aiming, if any;
	 * it is read every frame.
	 */
	constructor(app: Application, game: GameState, aiming: () => Aim | null = () => null) {
		this.#app = app;
		this.#game = game;
		this.#aiming = aiming;
		this.#queued
			.rect(0, 0, TILE_SIZE, TILE_SIZE)
			.stroke({ color: QUEUED, width: 1, alignment: 1, alpha: 0.35 });
		this.#queued.visible = false;
		this.#world.addChild(this.#ground, this.#queued, this.#aim, this.#bodies);
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

	destroy(): void {
		this.#app.ticker.remove(this.#frame);
		this.#sprites.clear();
		this.#chunkLayers.clear();
		this.#world.destroy({ children: true });
		this.#labels.destroy({ children: true });
	}

	#frame = (): void => {
		const nowMs = performance.now();
		const tickNow = this.#game.clock.now(nowMs);
		this.#world.scale.set(this.#zoom);
		this.#followCamera(tickNow);
		this.#drawGround();
		this.#drawCharacters(tickNow, nowMs);
		this.#showNewLines(nowMs);
		this.#drawQueued();
		this.#drawAim(tickNow);
	};

	/** Outlines the tiles an action could be aimed at, and the aimed one. */
	#drawAim(tickNow: number): void {
		const aim = this.#aiming();
		const me = this.#game.me;
		this.#aim.clear();
		if (!aim || !me) return;
		const [mx, my] = glidePosition(me, tickNow, this.#wrapWidth());
		const colour = AIM_COLOURS[aim.kind] ?? QUEUED;
		const [ax, ay] = aim.dir === null ? [0, 0] : DELTAS[aim.dir];
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const aimed = aim.dir !== null && dx === ax && dy === ay;
				this.#aim
					.rect(
						this.#snap((this.#nearX(Math.round(mx)) + dx) * TILE_SIZE),
						this.#snap((Math.round(my) + dy) * TILE_SIZE),
						TILE_SIZE,
						TILE_SIZE
					)
					.stroke({ color: colour, width: 1, alignment: 1, alpha: aimed ? 1 : 0.3 });
			}
		}
	}

	/** Puts each line heard since the last frame over its speaker. */
	#showNewLines(nowMs: number): void {
		const log = this.#game.log;
		let i = log.length;
		while (i > 0 && log[i - 1].seq > this.#seenSeq) i--;
		for (; i < log.length; i++) {
			this.#sprites.get(log[i].speakerId)?.bubble.show(log[i], nowMs);
		}
		this.#seenSeq = log.at(-1)?.seq ?? this.#seenSeq;
	}

	/**
	 * Centres the view on your own character, gliding with it. Before the
	 * snapshot names one, the map's centre is shown instead. The world's offset is
	 * always a whole number of physical pixels.
	 */
	#followCamera(tickNow: number): void {
		const me = this.#game.me;
		let centreX: number;
		let centreY: number;
		if (me) {
			const [x, y] = glidePosition(me, tickNow, this.#wrapWidth());
			this.#camX = x;
			centreX = this.#snap(x * TILE_SIZE) + TILE_SIZE / 2;
			centreY = this.#snap(y * TILE_SIZE) + TILE_SIZE / 2;
		} else {
			const map = this.#game.map;
			centreX = ((map?.width ?? 0) * TILE_SIZE) / 2;
			centreY = ((map?.height ?? 0) * TILE_SIZE) / 2;
		}
		this.#world.position.set(
			Math.round(this.#app.screen.width / 2 - centreX * this.#zoom),
			Math.round(this.#app.screen.height / 2 - centreY * this.#zoom)
		);
	}

	/** The map's width if it wraps east to west, else undefined. */
	#wrapWidth(): number | undefined {
		const map = this.#game.map;
		return map?.wrapsX ? map.width : undefined;
	}

	/** The copy of tile column x nearest the camera, on a map that wraps. */
	#nearX(x: number): number {
		const width = this.#wrapWidth();
		return width ? nearest(x, this.#camX, width) : x;
	}

	/**
	 * Keeps one layer per chunk the server has sent, and places each at its
	 * copy nearest the camera, so the ground carries on across the seam.
	 */
	#drawGround(): void {
		const chunks = this.#game.chunks;
		const size = this.#game.map?.chunkSize ?? 32;
		for (const [key, drawn] of this.#chunkLayers) {
			const chunk = chunks.get(key);
			// Gone, or changed since it was drawn: drop the old layer.
			if (!chunk || chunk.version !== drawn.version) {
				drawn.layer.destroy();
				this.#chunkLayers.delete(key);
			}
		}
		for (const [key, chunk] of chunks) {
			let layer = this.#chunkLayers.get(key)?.layer;
			if (!layer) {
				layer = drawChunk(chunk, size, this.#game.tileTypes);
				this.#chunkLayers.set(key, { layer, version: chunk.version });
				this.#ground.addChild(layer);
			}
			// The chunk's centre decides which copy is nearest.
			const left = this.#nearX(chunk.cx * size + size / 2) - size / 2;
			layer.position.set(left * TILE_SIZE, chunk.cy * size * TILE_SIZE);
		}
	}

	/** Shows the move you sent while stepping, which the server holds as queued. */
	#drawQueued(): void {
		const me = this.#game.me;
		const dir = this.#game.pendingMove;
		this.#queued.visible = !!(me?.step && dir !== null);
		if (!me?.step || dir === null) return;
		const [x, y] = queuedTarget(me.step.toX, me.step.toY, dir);
		this.#queued.position.set(this.#nearX(x) * TILE_SIZE, y * TILE_SIZE);
	}

	/** Rounds an art-pixel coordinate to a whole physical pixel. */
	#snap(v: number): number {
		return Math.round(v * this.#zoom) / this.#zoom;
	}

	/** Keeps one sprite per character in view, gliding along any step. */
	#drawCharacters(tickNow: number, nowMs: number): void {
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
				sprite = new CharacterSprite(c, this.#bodies, this.#labels);
				this.#sprites.set(c.id, sprite);
			}
			sprite.draw(c, c.id === this.#game.myId);
			const a = c.action;
			sprite.setProgress(
				a && tickNow >= a.startTick && tickNow < a.endTick
					? (tickNow - a.startTick) / (a.endTick - a.startTick)
					: null
			);
			const [gx, y] = glidePosition(c, tickNow, this.#wrapWidth());
			const x = this.#nearX(gx);
			sprite.place(
				this.#snap(x * TILE_SIZE),
				this.#snap(y * TILE_SIZE),
				this.#world.position,
				this.#zoom,
				this.#fontSize,
				nowMs
			);
		}
	}
}
