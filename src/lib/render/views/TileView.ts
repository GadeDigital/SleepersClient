import {
	AmbientLight,
	BoxGeometry,
	BufferGeometry,
	Color,
	CylinderGeometry,
	DirectionalLight,
	GreaterDepth,
	Group,
	InstancedMesh,
	LineBasicMaterial,
	LineLoop,
	PlaneGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	OrthographicCamera,
	Plane,
	Raycaster,
	RingGeometry,
	Scene,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
	Vector2,
	Vector3,
	type Texture
} from 'three';
import {
	chunkKey,
	EDGE_DOOR_EAST,
	EDGE_DOOR_SOUTH,
	EDGE_WALL_EAST,
	EDGE_WALL_SOUTH,
	isAsleep,
	isUnconscious,
	type CharacterView,
	type Chunk,
	type GameState
} from '$lib/net/game-state.svelte';
import {
	ActionKind,
	SpeechMode,
	type Direction,
	type MapInfo,
	type TileType
} from '$lib/proto/sleepers/v1/world_pb';
import { bubbleDuration } from '$lib/ui/speech';
import { DELTAS } from '$lib/world/directions';
import { glidePosition } from '$lib/world/glide';
import { queuedTarget } from '$lib/world/move-input';
import { wrapDelta } from '$lib/world/wrap';
import { makeLabel, type Label } from '../labels';
import { zTexture } from '../textures';
import { Batch, noise, shape } from './batch';
import { addProp, LEVEL, propBatches, type Lamp, type PropLabel } from './props';
import type { View } from './View';

/** The iso camera sits this far out and this high above its target (ADR 057). */
const CAM_OUT = 30;
const CAM_UP = 24.5;
/** Half the view's height in tiles, on landscape screens; portrait shows more. */
const HALF_HEIGHT = 9;
const PORTRAIT_HALF_WIDTH = 16;
/** A building's floor is seen closer, as a cutaway (ADR 064). */
const FLOOR_ZOOM = 1.3;

/** Wall blocks are cut down so you can see into rooms (ADR 057). */
const WALL_HEIGHT = 0.85;
const CAP = 0.04;
/** Walls on tile edges (ADR 055, ADR 074) are this thick. */
const THIN = 0.1;
const EDGE_WALL = 0x3e424c;
/** Columns of ground on authored maps reach down to here (ADR 065). */
const GROUND_BASE = -1;

/** Light intensities times π match the reference mockup's r128 lighting. */
const LIGHT = Math.PI;

/** Drawn for a tile id missing from the catalogue, so it stands out. */
const UNKNOWN = 0xff00ff;

/**
 * Character colours, picked by id. Amber is left out: in the view it means
 * "you" and "this tile".
 */
const COLOURS = [0x5fb4a2, 0xc9656f, 0x7f8fd6, 0xb8c46a, 0xc58ad6, 0x6fb7d9, 0xd9926f];
const AMBER = 0xf2a93b;

/** What the player is aiming: an action, and the direction held, if any. */
export interface Aim {
	kind: ActionKind;
	dir: Direction | null;
}

const AIM_COLOURS: Partial<Record<ActionKind, number>> = {
	[ActionKind.BUILD_WALL]: 0x7f8fd6,
	[ActionKind.REMOVE_WALL]: 0xc9656f
};

/** A tile with this tag is drawn as a bed (ADR 057, ADR 058). */
const SLEEP_TAG = 'sleep';
/** A sleeper lies on the bed's mattress. */
const ON_BED = 0.38;

/** Blocking tiles drawn as ground plus their own shape, not as a wall block. */
const SHAPED = ['water', 'solid', 'fixture', 'pod', 'fence', 'trees'];

interface DrawnChunk {
	group: Group;
	version: number;
	meshes: InstancedMesh[];
}

/** The props of the current map whose ground has arrived (ADR 074). */
interface DrawnProps {
	group: Group;
	meshes: InstancedMesh[];
	labels: Label[];
	lamps: Lamp[];
}

/** One character's figure and its name, speech and "z" markers. */
interface Figure {
	root: Group;
	/** Lying poses rotate this, inside the root's facing. */
	pose: Group;
	body: Mesh;
	bodyMat: MeshLambertMaterial;
	headMat: MeshLambertMaterial;
	/** A faint silhouette drawn over scenery that hides the figure. */
	xrayMat: MeshBasicMaterial;
	zs: Sprite[];
	ring: Mesh | null;
	label: Label;
	who: HTMLElement;
	name: HTMLElement;
	bubble: HTMLElement;
	bubbleUntil: number;
	/** An action's progress, under the name; its fill's width in percent, -1 hidden. */
	progress: HTMLElement;
	progressFill: HTMLElement;
	progressShown: number;
	drawn: { lying: 'no' | 'asleep' | 'unconscious'; isYou: boolean } | null;
	/** Where the name points, reused every frame. */
	head: Vector3;
	/** The height of the ground drawn under it, eased between levels. */
	ground: number;
}

/**
 * The game's zoom 1 on three.js (ADR 051, ADR 057): the tiles of the chunks
 * the server sent, and the characters on them, seen from an isometric
 * camera that follows you and turns in 90° steps. It draws what the game
 * state holds and never changes it (ADR 002).
 */
export class TileView implements View {
	readonly scene = new Scene();
	readonly camera = new OrthographicCamera(-10, 10, 10, -10, -300, 300);
	readonly labels: Label[] = [];
	/** The heading the camera is turning to; keys map by this one (ADR 057). */
	targetYaw = Math.PI / 4;
	#yaw = Math.PI / 4;

	readonly #game: GameState;
	readonly #layer: HTMLElement;
	/**
	 * The render origin, a tile near you: everything is placed relative to
	 * it, so raw tile coordinates never reach the GPU.
	 */
	#ox = 0;
	#oy = 0;
	#originSet = false;
	/** Where the camera looks, in tiles; may lie just past the seam. */
	#camX = 0;
	#camY = 0;

	readonly #chunks = new Map<string, DrawnChunk>();
	/** The map drawn; a new one clears everything (ADR 074). */
	#mapAddress: string | undefined;
	#props: DrawnProps | null = null;
	#propsDirty = false;
	/** The ground height under the camera's target, eased. */
	#camGround = 0;
	#zoom = 1;
	#size = { width: 0, height: 0, bufferHeight: 0 };
	readonly #figures = new Map<number, Figure>();
	#seenSeq = 0;
	/** Your step's direction, for facing, by character id. */
	readonly #facing = new Map<number, number>();

	readonly #box = new BoxGeometry(1, 1, 1);
	readonly #floorMat = new MeshLambertMaterial({ color: 0xffffff });
	readonly #wallMat = new MeshLambertMaterial({ color: 0xffffff });
	readonly #capMat = new MeshLambertMaterial({ color: 0xffffff });
	readonly #slabMat = new MeshLambertMaterial({ color: 0x1a2030 });
	readonly #detailMat = new MeshLambertMaterial({ color: 0xffffff });
	readonly #glowMat = new MeshBasicMaterial({ color: 0xffffff });
	readonly #cylinder = new CylinderGeometry(0.5, 0.5, 1, 10);
	readonly #plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	readonly #bodyGeo = new CylinderGeometry(0.18, 0.22, 0.48, 8);
	readonly #headGeo = new SphereGeometry(0.16, 8, 6);
	readonly #visorGeo = new BoxGeometry(0.2, 0.06, 0.06);
	readonly #packGeo = new BoxGeometry(0.22, 0.24, 0.1);
	readonly #ringGeo = new RingGeometry(0.28, 0.36, 20);
	readonly #visorMat = new MeshBasicMaterial({ color: 0x1b2230 });
	readonly #packMat = new MeshLambertMaterial({ color: 0x2a3140 });
	readonly #ringMat = new MeshBasicMaterial({ color: AMBER });
	readonly #zTex: Texture = zTexture();
	readonly #queuedMat = new LineBasicMaterial({
		color: 0xf2f2f2,
		transparent: true,
		opacity: 0.35
	});
	readonly #hoverMat = new LineBasicMaterial({ color: AMBER });
	readonly #aimDimMat = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
	readonly #aimMat = new LineBasicMaterial({ color: 0xffffff });
	/** What the player is aiming, if anything; read every frame. */
	aim: () => Aim | null = () => null;
	/** World units per art pixel, for snapping the camera; 0 before the first resize. */
	#unitsPerArtPixel = 0;
	readonly #aimTiles: LineLoop[] = [];

	readonly #queued: LineLoop;
	readonly #hover: LineLoop;
	readonly #ray = new Raycaster();
	readonly #ground = new Plane(new Vector3(0, 1, 0), 0);
	readonly #hit = new Vector3();
	readonly #ndc = new Vector2();
	readonly #colour = new Color();
	readonly #target = new Vector3();

	constructor(game: GameState, labelLayer: HTMLElement) {
		this.#game = game;
		this.#layer = labelLayer;
		this.scene.add(new AmbientLight(0x8a98bd, 0.62 * LIGHT));
		const sun = new DirectionalLight(0xffffff, 0.7 * LIGHT);
		sun.position.set(-8, 20, 10);
		this.scene.add(sun, sun.target);
		const fill = new DirectionalLight(0x6f8fd0, 0.25 * LIGHT);
		fill.position.set(10, 6, -12);
		this.scene.add(fill, fill.target);

		const square = () =>
			new BufferGeometry().setFromPoints([
				new Vector3(-0.46, 0, -0.46),
				new Vector3(0.46, 0, -0.46),
				new Vector3(0.46, 0, 0.46),
				new Vector3(-0.46, 0, 0.46)
			]);
		this.#queued = new LineLoop(square(), this.#queuedMat);
		this.#queued.visible = false;
		this.#hover = new LineLoop(square(), this.#hoverMat);
		this.#hover.visible = false;
		this.scene.add(this.#queued, this.#hover);
		// While aiming an action: the 8 neighbouring tiles, the aimed one bright.
		const aimSquare = square();
		for (let i = 0; i < 8; i++) {
			const loop = new LineLoop(aimSquare, this.#aimDimMat);
			loop.visible = false;
			this.#aimTiles.push(loop);
			this.scene.add(loop);
		}
	}

	/** Q (−1) and E (+1): turn the camera 90°, eased. */
	rotate(step: -1 | 1): void {
		this.targetYaw += (step * Math.PI) / 2;
	}

	/**
	 * Shows the amber outline on the tile under a point in normalised device
	 * coordinates, or hides it for null. Looking only: no click-to-walk yet.
	 */
	hover(ndc: { x: number; y: number } | null): void {
		const tile = ndc ? this.#tileUnder(ndc.x, ndc.y) : null;
		this.#hover.visible = tile !== null;
		if (tile) this.#place(this.#hover, tile[0], tile[1], this.#groundAt(tile[0], tile[1]) + 0.03);
	}

	resize(width: number, height: number, bufferHeight: number): void {
		this.#size = { width, height, bufferHeight };
		if (!(width > 0 && height > 0)) return;
		const aspect = width / height;
		const halfH = Math.max(HALF_HEIGHT, PORTRAIT_HALF_WIDTH / aspect) / this.#zoom;
		this.#unitsPerArtPixel = (2 * halfH) / bufferHeight;
		this.camera.left = -halfH * aspect;
		this.camera.right = halfH * aspect;
		this.camera.top = halfH;
		this.camera.bottom = -halfH;
		this.camera.updateProjectionMatrix();
	}

	enter(): void {}

	update(dt: number, t: number, active: boolean): void {
		if (!active) return;
		const nowMs = performance.now();
		const tickNow = this.#game.clock.now(nowMs);
		this.#checkMap();
		this.#follow(tickNow);
		this.#drawChunks();
		this.#drawProps();
		this.#drawCharacters(dt, t, tickNow, nowMs);
		this.#drawQueued();
		this.#drawAim(tickNow);
		this.#yaw += (this.targetYaw - this.#yaw) * Math.min(1, dt * 6);
		const me = this.#game.me;
		const ground = me ? this.#figures.get(me.id)?.ground : undefined;
		if (ground !== undefined) this.#camGround = ground;
		this.#ground.constant = -this.#camGround;
		const target = this.#target.set(
			this.#sceneX(this.#camX),
			this.#camGround,
			this.#camY - this.#oy + 0.5
		);
		this.camera.position.set(
			target.x + Math.sin(this.#yaw) * CAM_OUT,
			target.y + CAM_UP,
			target.z + Math.cos(this.#yaw) * CAM_OUT
		);
		this.camera.lookAt(target);
		this.#snapCamera();
	}

	/**
	 * Moves the camera to the nearest whole art pixel on screen, so the
	 * ground's pixels stay put while the camera follows you (ADR 066). The
	 * grid is anchored in map coordinates, not the render origin, so moving
	 * the origin does not shift it.
	 */
	#snapCamera(): void {
		const unit = this.#unitsPerArtPixel;
		if (!(unit > 0)) return;
		const cam = this.camera;
		cam.updateMatrixWorld();
		const right = SNAP_RIGHT.setFromMatrixColumn(cam.matrixWorld, 0);
		const up = SNAP_UP.setFromMatrixColumn(cam.matrixWorld, 1);
		const abs = SNAP_ABS.copy(cam.position).add(SNAP_ORIGIN.set(this.#ox, 0, this.#oy));
		const r = right.dot(abs);
		const u = up.dot(abs);
		const dr = Math.round(r / unit) * unit - r;
		const du = Math.round(u / unit) * unit - u;
		cam.position.addScaledVector(right, dr).addScaledVector(up, du);
		cam.updateMatrixWorld();
	}

	dispose(): void {
		this.#clearMap();
		for (const f of this.#figures.values()) this.#disposeFigure(f);
		this.#figures.clear();
		for (const g of [
			this.#box,
			this.#bodyGeo,
			this.#headGeo,
			this.#visorGeo,
			this.#packGeo,
			this.#ringGeo,
			this.#cylinder,
			this.#plane,
			this.#queued.geometry,
			this.#hover.geometry
		])
			g.dispose();
		for (const m of [
			this.#floorMat,
			this.#wallMat,
			this.#capMat,
			this.#slabMat,
			this.#visorMat,
			this.#packMat,
			this.#ringMat,
			this.#queuedMat,
			this.#hoverMat,
			this.#aimDimMat,
			this.#aimMat,
			this.#detailMat,
			this.#glowMat
		])
			m.dispose();
		this.#zTex.dispose();
	}

	/** The map's width if it wraps east to west (ADR 031), else undefined. */
	#wrapWidth(): number | undefined {
		const map = this.#game.map;
		return map?.wrapsX ? map.width : undefined;
	}

	/**
	 * A tile column's x in the scene: relative to the render origin, taking
	 * the copy nearest to it across the wrap. Tile centres are at +0.5.
	 */
	#sceneX(x: number): number {
		const w = this.#wrapWidth();
		return (w ? wrapDelta(x - this.#ox, w) : x - this.#ox) + 0.5;
	}

	#place(o: { position: Vector3 }, x: number, y: number, height: number): void {
		o.position.set(this.#sceneX(x), height, y - this.#oy + 0.5);
	}

	/**
	 * Follows your own character as it glides; before the snapshot names
	 * one, the map's centre. Moves the render origin once you are more than
	 * a chunk from it.
	 */
	#follow(tickNow: number): void {
		const me = this.#game.me;
		const map = this.#game.map;
		if (me) {
			[this.#camX, this.#camY] = glidePosition(me, tickNow, this.#wrapWidth());
		} else if (map) {
			this.#camX = map.width / 2;
			this.#camY = map.height / 2;
		}
		const size = map?.chunkSize ?? 32;
		const dx = this.#sceneX(this.#camX) - 0.5;
		if (!this.#originSet || Math.abs(dx) > size || Math.abs(this.#camY - this.#oy) > size) {
			const w = this.#wrapWidth();
			const x = Math.floor(this.#camX);
			this.#ox = w ? ((x % w) + w) % w : x;
			this.#oy = Math.floor(this.#camY);
			this.#originSet = true;
		}
	}

	/** Builds a group for each chunk the server holds for us, and places it. */
	#drawChunks(): void {
		const chunks = this.#game.chunks;
		const size = this.#game.map?.chunkSize ?? 32;
		for (const [key, drawn] of this.#chunks) {
			const chunk = chunks.get(key);
			// Gone, or changed since it was built: drop it. Only this chunk is
			// rebuilt, never the whole world.
			if (!chunk || chunk.version !== drawn.version) {
				this.#disposeChunk(drawn);
				this.#chunks.delete(key);
				this.#propsDirty = true;
			}
		}
		for (const [key, chunk] of chunks) {
			let drawn = this.#chunks.get(key);
			if (!drawn) {
				drawn = this.#buildChunk(chunk, size, this.#game.tileTypes);
				this.#chunks.set(key, drawn);
				this.scene.add(drawn.group);
				this.#propsDirty = true;
			}
			// The chunk's centre decides which copy across the wrap is nearest.
			const left = this.#sceneX(chunk.cx * size + size / 2) - 0.5 - size / 2;
			drawn.group.position.set(left, 0, chunk.cy * size - this.#oy);
		}
	}

	/**
	 * One chunk as instanced meshes (ADR 057). Each tile is drawn by its
	 * tags: ground (a column on authored maps, which have heights, ADR 065),
	 * then a wall block, a fence, dead trees, stairs, a lift's plate or a bed;
	 * walls stand on tile edges where the chunk says so (ADR 074). Void is
	 * left out, so a building's floor floats in the dark.
	 */
	#buildChunk(chunk: Chunk, size: number, types: ReadonlyMap<number, TileType>): DrawnChunk {
		const group = new Group();
		const ground = new Batch();
		const wall = new Batch();
		const cap = new Batch();
		const detail = new Batch();
		const glow = new Batch();
		const c = this.#colour;
		const map = this.#game.map;
		const indoors = !!map?.building;
		const authored = chunk.heights !== null;
		const tagsAt = (wx: number, wy: number): readonly string[] | null => {
			const id = this.#tileAt(wx, wy);
			return id === null ? null : (types.get(id)?.tags ?? []);
		};
		const edgeWall = (x: number, z: number, g: number, alongX: boolean) => {
			const [sx, sz] = alongX ? [1 + THIN, THIN] : [THIN, 1 + THIN];
			wall.add(shape(x, g + WALL_HEIGHT / 2, z, sx, WALL_HEIGHT, sz), EDGE_WALL);
			cap.add(
				shape(x, g + WALL_HEIGHT + CAP / 2, z, sx, CAP, sz),
				c.set(EDGE_WALL).lerp(WHITE, 0.3)
			);
		};

		for (let ly = 0; ly < size; ly++) {
			for (let lx = 0; lx < size; lx++) {
				const i = ly * size + lx;
				const type = types.get(chunk.tiles[i]);
				const tags = type?.tags ?? [];
				if (tags.includes('void')) continue;
				const colour = type ? type.colour : UNKNOWN;
				const wx = chunk.cx * size + lx;
				const wy = chunk.cy * size + ly;
				const x = lx + 0.5;
				const z = ly + 0.5;
				const g = (chunk.heights?.[i] ?? 0) * LEVEL;
				const water = tags.includes('water');
				// The mockup's checker and slight variation, fixed per tile.
				c.set(colour);
				if (!water) c.multiplyScalar(((wx + wy) % 2 ? 1.0 : 1.12) * (0.95 + noise(wx, wy) * 0.08));
				if (type?.tags.includes(SLEEP_TAG)) c.multiplyScalar(0.55); // so the bed stands out
				const top = water ? g - 0.25 : g;
				if (authored) {
					ground.add(shape(x, (top + GROUND_BASE) / 2, z, 1, top - GROUND_BASE, 1), c);
				} else {
					ground.add(shape(x, -0.03, z, 0.98, 0.06, 0.98), c);
				}

				if (type?.blocks && !tags.some((t) => SHAPED.includes(t))) {
					// A wall block, cut down so you can see past it; a cliff stands taller.
					const wh = tags.includes('edge') ? WALL_HEIGHT * 1.6 : WALL_HEIGHT;
					wall.add(shape(x, g + wh / 2, z, 1, wh, 1), colour);
					cap.add(shape(x, g + wh + CAP / 2, z, 1, CAP, 1), c.set(colour).lerp(WHITE, 0.35));
				} else if (tags.includes('trees')) {
					// Dead trees: bare trunks with a crooked branch or two.
					for (let k = 0; k < 2; k++) {
						const n = noise(wx, wy, k + 1);
						const th = 1.4 + n * 1.4;
						const tx = x - 0.25 + noise(wx, wy, k + 11) * 0.5;
						const tz = z - 0.25 + noise(wx, wy, k + 21) * 0.5;
						const trunk = c.set(0x2a2520).multiplyScalar(0.8 + n * 0.4);
						detail.add(shape(tx, g + th / 2, tz, 0.12, th, 0.12, n * 3, (n - 0.5) * 0.15), trunk);
						detail.add(shape(tx + 0.12, g + th * 0.7, tz, 0.05, th * 0.4, 0.05, n * 6, 0.7), trunk);
					}
				} else if (tags.includes('fence')) {
					// Chain-link along the fence's line, with a post.
					const east =
						tagsAt(wx + 1, wy)?.includes('fence') || tagsAt(wx - 1, wy)?.includes('fence');
					const [sx, sz] = east ? [1, 0.04] : [0.04, 1];
					detail.add(shape(x, g + 0.75, z, sx, 1.5, sz), 0x3a3e42);
					detail.add(shape(x, g + 0.8, z, 0.08, 1.6, 0.08), 0x24272a);
				} else if (tags.includes('stairs')) {
					for (let k = 0; k < 4; k++) {
						const sh = (k + 1) * 0.12;
						detail.add(
							shape(x, g + sh / 2, z + 0.375 - k * 0.25, 0.9, sh, 0.25),
							c.set(colour).multiplyScalar(1.2 + k * 0.08)
						);
					}
				} else if (tags.includes('lift')) {
					glow.add(shape(x, g + 0.005, z, 0.72, 0.01, 0.72), c.set(0x2f8f9a).multiplyScalar(0.55));
				} else if (tags.includes('entrance') || tags.includes('exit')) {
					glow.add(shape(x, g + 0.005, z, 0.8, 0.01, 0.8), c.set(0xb07a2a).multiplyScalar(0.45));
				} else if (tags.includes(SLEEP_TAG)) {
					// A bed: a dark frame, a mattress in the tile's colour, a pillow at the north end.
					detail.add(shape(x, g + 0.11, z, 0.86, 0.22, 0.94), 0x4a3f36);
					detail.add(shape(x, g + 0.26, z + 0.1, 0.8, 0.08, 0.72), colour);
					detail.add(shape(x, g + 0.27, z - 0.34, 0.6, 0.07, 0.18), 0xd8d4cc);
				}

				// Thin walls on the east and south edges, unless a doorway; a
				// building's floor is walled all round too, but for its way out.
				const e = chunk.edges?.[i] ?? 0;
				const wallE = (e & EDGE_WALL_EAST) !== 0 && (e & EDGE_DOOR_EAST) === 0;
				const wallS = (e & EDGE_WALL_SOUTH) !== 0 && (e & EDGE_DOOR_SOUTH) === 0;
				if (wallE) edgeWall(x + 0.5, z, g, false);
				if (wallS) edgeWall(x, z + 0.5, g, true);
				if (indoors && map) {
					const out = tags.includes('exit');
					if (wx === 0) edgeWall(x - 0.5, z, g, false);
					if (wy === 0) edgeWall(x, z - 0.5, g, true);
					if (wx === map.width - 1 && !wallE && !out) edgeWall(x + 0.5, z, g, false);
					if (wy === map.height - 1 && !wallS && !out) edgeWall(x, z + 0.5, g, true);
				}
			}
		}

		const meshes: InstancedMesh[] = [];
		if (!authored) {
			const slab = new InstancedMesh(this.#box, this.#slabMat, 1);
			slab.setMatrixAt(0, shape(size / 2, -0.36, size / 2, size, 0.6, size));
			meshes.push(slab);
		}
		for (const [batch, mat] of [
			[ground, this.#floorMat],
			[wall, this.#wallMat],
			[cap, this.#capMat],
			[detail, this.#detailMat],
			[glow, this.#glowMat]
		] as const) {
			const mesh = batch.build(this.#box, mat);
			if (mesh) meshes.push(mesh);
		}
		for (const m of meshes) group.add(m);
		return { group, version: chunk.version, meshes };
	}

	/** The tile id at a map tile, if its chunk is here. */
	#tileAt(x: number, y: number): number | null {
		const chunk = this.#chunkAt(x, y);
		if (!chunk) return null;
		const size = this.#game.map?.chunkSize ?? 32;
		return chunk.tiles[(y - chunk.cy * size) * size + (x - chunk.cx * size)];
	}

	/** The ground's height level at a map tile (ADR 065), or null if its chunk is not here. */
	#levelAt(x: number, y: number): number | null {
		const chunk = this.#chunkAt(x, y);
		if (!chunk) return null;
		if (!chunk.heights) return 0;
		const size = this.#game.map?.chunkSize ?? 32;
		return chunk.heights[(y - chunk.cy * size) * size + (x - chunk.cx * size)];
	}

	/** The height of the ground's top at a map tile, 0 where it is unknown. */
	#groundAt(x: number, y: number): number {
		return (this.#levelAt(x, y) ?? 0) * LEVEL;
	}

	#chunkAt(x: number, y: number): Chunk | undefined {
		const size = this.#game.map?.chunkSize ?? 32;
		const w = this.#wrapWidth();
		if (w) x = ((x % w) + w) % w;
		return this.#game.chunks.get(chunkKey(Math.floor(x / size), Math.floor(y / size)));
	}

	/**
	 * On a new map (stairs, a lift, a door; ADR 074) drops everything drawn
	 * for the old one and sets the zoom for the new.
	 */
	#checkMap(): void {
		const map = this.#game.map;
		const address = map?.ref?.address;
		if (address === this.#mapAddress) return;
		this.#mapAddress = address;
		this.#clearMap();
		this.#originSet = false;
		this.#camGround = 0;
		this.#zoom = map?.building ? FLOOR_ZOOM : 1;
		const { width, height, bufferHeight } = this.#size;
		this.resize(width, height, bufferHeight);
		this.#mapChanged(map);
	}

	/** Lighting and the like for a new map; see the dark dressing. */
	#mapChanged(map: MapInfo | null): void {
		void map;
	}

	#clearMap(): void {
		for (const c of this.#chunks.values()) this.#disposeChunk(c);
		this.#chunks.clear();
		this.#disposeProps();
	}

	/**
	 * Builds the map's props whose ground has arrived (ADR 074), again
	 * whenever chunks come or go; a prop is placed on the ground under its
	 * north-west tile.
	 */
	#drawProps(): void {
		if (this.#propsDirty) {
			this.#propsDirty = false;
			this.#disposeProps();
			const props = this.#game.map?.props ?? [];
			if (props.length > 0) this.#props = this.#buildProps(props);
		}
		this.#props?.group.position.set(-this.#ox, 0, -this.#oy);
	}

	#buildProps(props: MapInfo['props']): DrawnProps {
		const b = propBatches();
		const labels: PropLabel[] = [];
		const lamps: Lamp[] = [];
		for (const p of props) {
			const level = this.#levelAt(p.x, p.y);
			if (level === null) continue;
			const lamp = addProp(b, p, level * LEVEL, labels);
			if (lamp) lamps.push(lamp);
		}
		const group = new Group();
		const meshes: InstancedMesh[] = [];
		for (const [batch, geo, mat] of [
			[b.box, this.#box, this.#detailMat],
			[b.cylinder, this.#cylinder, this.#detailMat],
			[b.glowBox, this.#box, this.#glowMat],
			[b.glowCylinder, this.#cylinder, this.#glowMat]
		] as const) {
			const mesh = batch.build(geo, mat);
			if (mesh) meshes.push(mesh);
		}
		for (const m of meshes) group.add(m);
		this.scene.add(group);
		const drawn: Label[] = labels.map((l) => {
			const at = new Vector3();
			const variant =
				l.kind === 'hydra-facility' ? 'cyan' : l.kind === 'exchange' ? 'amber' : 'quiet';
			return makeLabel(
				this.#layer,
				l.text,
				variant,
				() => at.set(l.x - this.#ox, l.y, l.z - this.#oy),
				6
			);
		});
		this.labels.push(...drawn);
		return { group, meshes, labels: drawn, lamps };
	}

	#disposeProps(): void {
		const p = this.#props;
		if (!p) return;
		this.#props = null;
		p.group.removeFromParent();
		for (const m of p.meshes) m.dispose();
		for (const l of p.labels) {
			l.el.remove();
			const i = this.labels.indexOf(l);
			if (i >= 0) this.labels.splice(i, 1);
		}
	}

	#disposeChunk(drawn: DrawnChunk): void {
		drawn.group.removeFromParent();
		// Geometry and materials are shared; only the instance buffers go.
		for (const m of drawn.meshes) m.dispose();
	}

	/** Keeps one figure per character in view, gliding along any step. */
	#drawCharacters(dt: number, t: number, tickNow: number, nowMs: number): void {
		const characters = this.#game.characters;
		for (const [id, f] of this.#figures) {
			if (!(id in characters)) {
				this.#disposeFigure(f);
				this.#figures.delete(id);
				this.#facing.delete(id);
			}
		}
		for (const c of Object.values(characters)) {
			let f = this.#figures.get(c.id);
			if (!f) {
				f = this.#makeFigure(c);
				this.#figures.set(c.id, f);
			}
			this.#pose(f, c);
			const [gx, gy] = glidePosition(c, tickNow, this.#wrapWidth());
			// Up or down a level as you step (ADR 065), eased; a jump of more
			// than a level, as on another map, is not.
			const ground = this.#groundAt(Math.round(gx), Math.round(gy));
			f.ground =
				Number.isNaN(f.ground) || Math.abs(ground - f.ground) > 1.5 * LEVEL
					? ground
					: f.ground + (ground - f.ground) * Math.min(1, dt * 10);
			this.#place(f.root, gx, gy, f.ground);
			// Face the way you are stepping, turning smoothly.
			const s = c.step;
			const walking = !!s && tickNow < s.arriveTick && f.drawn?.lying === 'no';
			if (s && f.drawn?.lying === 'no') {
				const w = this.#wrapWidth();
				const dx = w ? wrapDelta(s.toX - s.fromX, w) : s.toX - s.fromX;
				const dy = s.toY - s.fromY;
				if (dx || dy) this.#facing.set(c.id, Math.atan2(dx, dy));
			}
			// Sleepers lie head to the north, on the pillow.
			const facing = f.drawn?.lying === 'asleep' ? 0 : this.#facing.get(c.id);
			if (facing !== undefined) {
				let d = facing - f.root.rotation.y;
				d = Math.atan2(Math.sin(d), Math.cos(d));
				f.root.rotation.y += d * Math.min(1, dt * 14);
			}
			f.body.position.y = walking ? 0.3 + Math.abs(Math.sin(t * 13)) * 0.035 : 0.3;
			this.#showProgress(f, c, tickNow);
			for (let k = 0; k < f.zs.length; k++) {
				const u = (t * 0.35 + k / 3) % 1;
				f.zs[k].position.set(Math.sin(u * 6) * 0.12 + u * 0.3, ON_BED + 0.25 + u * 1.1, 0);
				f.zs[k].material.opacity = Math.sin(u * Math.PI) * 0.9;
			}
			const lying = f.drawn?.lying;
			f.head.set(
				f.root.position.x,
				f.ground + (lying === 'no' ? 1.05 : lying === 'asleep' ? 0.75 : 0.55),
				f.root.position.z
			);
			if (f.bubble.hidden !== nowMs >= f.bubbleUntil) f.bubble.hidden = nowMs >= f.bubbleUntil;
		}
		this.#showNewLines(nowMs);
	}

	/** Puts each line heard since the last frame over its speaker. */
	#showNewLines(nowMs: number): void {
		const log = this.#game.log;
		let i = log.length;
		while (i > 0 && log[i - 1].seq > this.#seenSeq) i--;
		for (; i < log.length; i++) {
			const entry = log[i];
			const f = this.#figures.get(entry.speakerId);
			if (!f) continue;
			f.bubble.textContent = entry.text;
			f.bubble.className = [
				'bubble',
				entry.muffled ? 'muffled' : '',
				entry.muffled || entry.mode === SpeechMode.WHISPER ? 'soft' : '',
				entry.mode === SpeechMode.YELL ? 'loud' : ''
			]
				.filter(Boolean)
				.join(' ');
			f.bubbleUntil = nowMs + bubbleDuration(entry.text);
			f.bubble.hidden = false;
			// The newest line is drawn on top where bubbles overlap.
			f.who.style.zIndex = String(entry.seq);
		}
		this.#seenSeq = log.at(-1)?.seq ?? this.#seenSeq;
	}

	#makeFigure(c: CharacterView): Figure {
		const root = new Group();
		const pose = new Group();
		root.add(pose);
		const bodyMat = new MeshLambertMaterial({ color: COLOURS[c.id % COLOURS.length] });
		const headMat = new MeshLambertMaterial({ color: 0xd9b99b });
		const body = new Mesh(this.#bodyGeo, bodyMat);
		body.position.y = 0.3;
		const head = new Mesh(this.#headGeo, headMat);
		head.position.y = 0.69;
		const visor = new Mesh(this.#visorGeo, this.#visorMat);
		visor.position.set(0, 0.71, 0.14);
		const pack = new Mesh(this.#packGeo, this.#packMat);
		pack.position.set(0, 0.36, -0.2);
		pose.add(body, head, visor, pack);
		// Seen through walls and buildings in front of it, faintly, so a
		// building between you and the camera never loses you (ADR 074).
		const xrayMat = new MeshBasicMaterial({
			color: COLOURS[c.id % COLOURS.length],
			transparent: true,
			opacity: 0.35,
			// Only where something nearer the camera hides it.
			depthFunc: GreaterDepth,
			depthWrite: false
		});
		for (const part of [body, head]) {
			const ghost = new Mesh(part.geometry, xrayMat);
			ghost.position.copy(part.position);
			ghost.renderOrder = 10;
			pose.add(ghost);
		}
		this.scene.add(root);

		// The name, with any speech bubble stacked above it, as one HTML label.
		const who = document.createElement('div');
		who.className = 'char-tag';
		const bubble = document.createElement('div');
		bubble.className = 'bubble';
		bubble.hidden = true;
		const name = document.createElement('div');
		name.className = 'lbl';
		name.textContent = c.name;
		const progress = document.createElement('div');
		progress.className = 'progress';
		progress.hidden = true;
		const progressFill = document.createElement('i');
		progress.append(progressFill);
		who.append(bubble, name, progress);
		who.style.visibility = 'hidden';
		this.#layer.appendChild(who);
		const headPos = new Vector3();
		const label: Label = { el: who, pos: headPos, lift: 4 };
		this.labels.push(label);
		return {
			root,
			pose,
			body,
			bodyMat,
			headMat,
			xrayMat,
			zs: [],
			ring: null,
			label,
			who,
			name,
			bubble,
			bubbleUntil: 0,
			progress,
			progressFill,
			progressShown: -1,
			drawn: null,
			head: headPos,
			ground: NaN
		};
	}

	/** Stands, or lies down asleep or unconscious; cheap when nothing changed. */
	#pose(f: Figure, c: CharacterView): void {
		const lying = isUnconscious(c) ? 'unconscious' : isAsleep(c) ? 'asleep' : 'no';
		const isYou = c.id === this.#game.myId;
		if (f.drawn?.lying === lying && f.drawn.isYou === isYou) return;
		f.drawn = { lying, isYou };
		// Sleepers lie on their back; the unconscious lie on their side,
		// dimmed, so the two are easy to tell apart.
		f.pose.rotation.set(0, 0, 0);
		f.pose.position.set(0, 0, 0);
		if (lying === 'asleep') {
			f.pose.rotation.x = -Math.PI / 2;
			f.pose.position.set(0, ON_BED, 0.36);
			f.root.rotation.y = 0;
		} else if (lying === 'unconscious') {
			f.pose.rotation.z = Math.PI / 2;
			f.pose.position.set(0.36, 0.2, 0);
		}
		const base = COLOURS[c.id % COLOURS.length];
		const dim = lying === 'unconscious' ? 0.5 : 1;
		f.bodyMat.color.set(base).multiplyScalar(dim);
		f.headMat.color.set(0xd9b99b).multiplyScalar(dim);

		// The rising z's over a sleeper.
		const wantZ = lying === 'asleep' ? 3 : 0;
		while (f.zs.length > wantZ) {
			const z = f.zs.pop();
			z?.removeFromParent();
			z?.material.dispose();
		}
		while (f.zs.length < wantZ) {
			const s = new Sprite(
				new SpriteMaterial({
					map: this.#zTex,
					color: 0xbfeeea,
					transparent: true,
					depthWrite: false
				})
			);
			s.scale.set(0.34, 0.34, 1);
			f.root.add(s);
			f.zs.push(s);
		}

		// Your own character has the amber ring at its feet.
		if (isYou && !f.ring) {
			f.ring = new Mesh(this.#ringGeo, this.#ringMat);
			f.ring.rotation.x = -Math.PI / 2;
			f.ring.position.y = 0.02;
			f.root.add(f.ring);
		} else if (!isYou && f.ring) {
			f.ring.removeFromParent();
			f.ring = null;
		}
		f.name.className = isYou ? 'lbl amber' : 'lbl';
		f.who.classList.toggle('down', lying === 'unconscious');
	}

	#disposeFigure(f: Figure): void {
		f.root.removeFromParent();
		f.bodyMat.dispose();
		f.headMat.dispose();
		f.xrayMat.dispose();
		for (const z of f.zs) z.material.dispose();
		f.who.remove();
		const i = this.labels.indexOf(f.label);
		if (i >= 0) this.labels.splice(i, 1);
	}

	/** An action under way as a bar under the name; updated only when it grows. */
	#showProgress(f: Figure, c: CharacterView, tickNow: number): void {
		const a = c.action;
		const pct =
			a && tickNow >= a.startTick && tickNow < a.endTick
				? Math.round(((tickNow - a.startTick) / (a.endTick - a.startTick)) * 100)
				: -1;
		if (pct === f.progressShown) return;
		f.progressShown = pct;
		f.progress.hidden = pct < 0;
		if (pct >= 0) f.progressFill.style.width = `${pct}%`;
	}

	/** Outlines the tiles an action could be aimed at, and the aimed one. */
	#drawAim(tickNow: number): void {
		const aim = this.aim();
		const me = this.#game.me;
		if (!aim || !me) {
			for (const loop of this.#aimTiles) loop.visible = false;
			return;
		}
		const colour = AIM_COLOURS[aim.kind] ?? 0xf2f2f2;
		this.#aimDimMat.color.set(colour);
		this.#aimMat.color.set(colour);
		const [mx, my] = glidePosition(me, tickNow, this.#wrapWidth());
		const [ax, ay] = aim.dir === null ? [0, 0] : DELTAS[aim.dir];
		let i = 0;
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const loop = this.#aimTiles[i++];
				loop.visible = true;
				loop.material = aim.dir !== null && dx === ax && dy === ay ? this.#aimMat : this.#aimDimMat;
				const ax2 = Math.round(mx) + dx;
				const ay2 = Math.round(my) + dy;
				this.#place(loop, ax2, ay2, this.#groundAt(ax2, ay2) + 0.04);
			}
		}
	}

	/** Shows the move you sent while stepping, which the server holds as queued. */
	#drawQueued(): void {
		const me = this.#game.me;
		const dir = this.#game.pendingMove;
		this.#queued.visible = !!(me?.step && dir !== null);
		if (!me?.step || dir === null) return;
		const [x, y] = queuedTarget(me.step.toX, me.step.toY, dir);
		this.#place(this.#queued, x, y, this.#groundAt(x, y) + 0.03);
	}

	/** The tile under a point, in map coordinates, or null off the map. */
	#tileUnder(ndcX: number, ndcY: number): [number, number] | null {
		const map = this.#game.map;
		if (!map) return null;
		this.#ray.setFromCamera(this.#ndc.set(ndcX, ndcY), this.camera);
		if (!this.#ray.ray.intersectPlane(this.#ground, this.#hit)) return null;
		const x = Math.floor(this.#hit.x + this.#ox);
		const y = Math.floor(this.#hit.z + this.#oy);
		if (y < 0 || y >= map.height) return null;
		const w = this.#wrapWidth();
		if (w) return [((x % w) + w) % w, y];
		return x < 0 || x >= map.width ? null : [x, y];
	}
}

const WHITE = new Color(0xffffff);
const SNAP_RIGHT = new Vector3();
const SNAP_UP = new Vector3();
const SNAP_ABS = new Vector3();
const SNAP_ORIGIN = new Vector3();
