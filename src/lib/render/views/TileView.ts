import {
	AmbientLight,
	BoxGeometry,
	BufferGeometry,
	Color,
	CylinderGeometry,
	DirectionalLight,
	Group,
	InstancedMesh,
	LineBasicMaterial,
	LineLoop,
	Matrix4,
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
	isAsleep,
	isUnconscious,
	type CharacterView,
	type Chunk,
	type GameState
} from '$lib/net/game-state.svelte';
import { SpeechMode, type TileType } from '$lib/proto/sleepers/v1/world_pb';
import { bubbleDuration } from '$lib/ui/speech';
import { glidePosition } from '$lib/world/glide';
import { queuedTarget } from '$lib/world/move-input';
import { wrapDelta } from '$lib/world/wrap';
import type { Label } from '../labels';
import { zTexture } from '../textures';
import type { View } from './View';

/** The iso camera sits this far out and this high above its target (ADR 057). */
const CAM_OUT = 30;
const CAM_UP = 24.5;
/** Half the view's height in tiles, on landscape screens; portrait shows more. */
const HALF_HEIGHT = 9;
const PORTRAIT_HALF_WIDTH = 16;

/** Wall blocks are cut down so you can see into rooms (ADR 057). */
const WALL_HEIGHT = 0.85;
const CAP = 0.04;

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

/** A deterministic 0–1 value per tile, for the floor's slight colour variation. */
function tileNoise(x: number, y: number): number {
	let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface DrawnChunk {
	group: Group;
	version: number;
	meshes: InstancedMesh[];
}

/** One character's figure and its name, speech and "z" markers. */
interface Figure {
	root: Group;
	/** Lying poses rotate this, inside the root's facing. */
	pose: Group;
	body: Mesh;
	bodyMat: MeshLambertMaterial;
	headMat: MeshLambertMaterial;
	zs: Sprite[];
	ring: Mesh | null;
	label: Label;
	who: HTMLElement;
	name: HTMLElement;
	bubble: HTMLElement;
	bubbleUntil: number;
	drawn: { lying: 'no' | 'asleep' | 'unconscious'; isYou: boolean } | null;
	/** Where the name points, reused every frame. */
	head: Vector3;
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
	readonly #figures = new Map<number, Figure>();
	#seenSeq = 0;
	/** Your step's direction, for facing, by character id. */
	readonly #facing = new Map<number, number>();

	readonly #box = new BoxGeometry(1, 1, 1);
	readonly #floorMat = new MeshLambertMaterial({ color: 0xffffff });
	readonly #wallMat = new MeshLambertMaterial({ color: 0xffffff });
	readonly #capMat = new MeshLambertMaterial({ color: 0xffffff });
	readonly #slabMat = new MeshLambertMaterial({ color: 0x1a2030 });
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
		if (tile) this.#place(this.#hover, tile[0], tile[1], 0.03);
	}

	resize(width: number, height: number): void {
		const aspect = width / height;
		const halfH = Math.max(HALF_HEIGHT, PORTRAIT_HALF_WIDTH / aspect);
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
		this.#follow(tickNow);
		this.#drawChunks();
		this.#drawCharacters(dt, t, tickNow, nowMs);
		this.#drawQueued();
		this.#yaw += (this.targetYaw - this.#yaw) * Math.min(1, dt * 6);
		const target = this.#target.set(this.#sceneX(this.#camX), 0, this.#camY - this.#oy + 0.5);
		this.camera.position.set(
			target.x + Math.sin(this.#yaw) * CAM_OUT,
			CAM_UP,
			target.z + Math.cos(this.#yaw) * CAM_OUT
		);
		this.camera.lookAt(target);
	}

	dispose(): void {
		for (const c of this.#chunks.values()) this.#disposeChunk(c);
		this.#chunks.clear();
		for (const f of this.#figures.values()) this.#disposeFigure(f);
		this.#figures.clear();
		for (const g of [
			this.#box,
			this.#bodyGeo,
			this.#headGeo,
			this.#visorGeo,
			this.#packGeo,
			this.#ringGeo,
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
			this.#hoverMat
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
			}
		}
		for (const [key, chunk] of chunks) {
			let drawn = this.#chunks.get(key);
			if (!drawn) {
				drawn = this.#buildChunk(chunk, size, this.#game.tileTypes);
				this.#chunks.set(key, drawn);
				this.scene.add(drawn.group);
			}
			// The chunk's centre decides which copy across the wrap is nearest.
			const left = this.#sceneX(chunk.cx * size + size / 2) - 0.5 - size / 2;
			drawn.group.position.set(left, 0, chunk.cy * size - this.#oy);
		}
	}

	/**
	 * One chunk as instanced meshes (ADR 057): a dark slab, a floor plate on
	 * every open tile in the catalogue's colour, and a low wall block with a
	 * lighter cap on every tile that blocks movement.
	 */
	#buildChunk(chunk: Chunk, size: number, types: ReadonlyMap<number, TileType>): DrawnChunk {
		const group = new Group();
		let open = 0;
		for (const id of chunk.tiles) if (!types.get(id)?.blocks) open++;
		const walls = size * size - open;
		const slab = new InstancedMesh(this.#box, this.#slabMat, 1);
		slab.setMatrixAt(0, matrix(size / 2, -0.36, size / 2, size, 0.6, size));
		const floor = new InstancedMesh(this.#box, this.#floorMat, Math.max(1, open));
		const wall = new InstancedMesh(this.#box, this.#wallMat, Math.max(1, walls));
		const cap = new InstancedMesh(this.#box, this.#capMat, Math.max(1, walls));
		floor.count = open;
		wall.count = walls;
		cap.count = walls;
		const c = this.#colour;
		let fi = 0;
		let wi = 0;
		for (let ly = 0; ly < size; ly++) {
			for (let lx = 0; lx < size; lx++) {
				const type = types.get(chunk.tiles[ly * size + lx]);
				const colour = type ? type.colour : UNKNOWN;
				const x = lx + 0.5;
				const z = ly + 0.5;
				if (type?.blocks) {
					wall.setMatrixAt(wi, matrix(x, WALL_HEIGHT / 2, z, 1, WALL_HEIGHT, 1));
					wall.setColorAt(wi, c.set(colour));
					cap.setMatrixAt(wi, matrix(x, WALL_HEIGHT + CAP / 2, z, 1, CAP, 1));
					cap.setColorAt(wi, c.set(colour).lerp(WHITE, 0.35));
					wi++;
				} else {
					const wx = chunk.cx * size + lx;
					const wy = chunk.cy * size + ly;
					floor.setMatrixAt(fi, matrix(x, -0.03, z, 0.98, 0.06, 0.98));
					// The mockup's checker and slight variation, fixed per tile.
					c.set(colour).multiplyScalar(
						((wx + wy) % 2 ? 1.0 : 1.12) * (0.95 + tileNoise(wx, wy) * 0.08)
					);
					floor.setColorAt(fi, c);
					fi++;
				}
			}
		}
		const meshes = [slab, floor, wall, cap];
		for (const m of meshes) {
			if (m.instanceColor) m.instanceColor.needsUpdate = true;
			if (m.count > 0) group.add(m);
		}
		return { group, version: chunk.version, meshes };
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
			this.#place(f.root, gx, gy, 0);
			// Face the way you are stepping, turning smoothly.
			const s = c.step;
			const walking = !!s && tickNow < s.arriveTick && f.drawn?.lying === 'no';
			if (s && f.drawn?.lying === 'no') {
				const w = this.#wrapWidth();
				const dx = w ? wrapDelta(s.toX - s.fromX, w) : s.toX - s.fromX;
				const dy = s.toY - s.fromY;
				if (dx || dy) this.#facing.set(c.id, Math.atan2(dx, dy));
			}
			const facing = this.#facing.get(c.id);
			if (facing !== undefined) {
				let d = facing - f.root.rotation.y;
				d = Math.atan2(Math.sin(d), Math.cos(d));
				f.root.rotation.y += d * Math.min(1, dt * 14);
			}
			f.body.position.y = walking ? 0.3 + Math.abs(Math.sin(t * 13)) * 0.035 : 0.3;
			for (let k = 0; k < f.zs.length; k++) {
				const u = (t * 0.35 + k / 3) % 1;
				f.zs[k].position.set(Math.sin(u * 6) * 0.12 + u * 0.3, 0.45 + u * 1.1, 0);
				f.zs[k].material.opacity = Math.sin(u * Math.PI) * 0.9;
			}
			f.head.set(f.root.position.x, f.drawn?.lying === 'no' ? 1.05 : 0.55, f.root.position.z);
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
		who.append(bubble, name);
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
			zs: [],
			ring: null,
			label,
			who,
			name,
			bubble,
			bubbleUntil: 0,
			drawn: null,
			head: headPos
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
			f.pose.position.set(0, 0.2, 0.36);
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
		for (const z of f.zs) z.material.dispose();
		f.who.remove();
		const i = this.labels.indexOf(f.label);
		if (i >= 0) this.labels.splice(i, 1);
	}

	/** Shows the move you sent while stepping, which the server holds as queued. */
	#drawQueued(): void {
		const me = this.#game.me;
		const dir = this.#game.pendingMove;
		this.#queued.visible = !!(me?.step && dir !== null);
		if (!me?.step || dir === null) return;
		const [x, y] = queuedTarget(me.step.toX, me.step.toY, dir);
		this.#place(this.#queued, x, y, 0.03);
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
const m4 = new Matrix4();

/** An instance matrix: position and scale, no rotation. */
function matrix(x: number, y: number, z: number, sx: number, sy: number, sz: number): Matrix4 {
	return m4.makeScale(sx, sy, sz).setPosition(x, y, z);
}
