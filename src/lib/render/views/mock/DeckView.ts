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
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	OctahedronGeometry,
	OrthographicCamera,
	Plane,
	PlaneGeometry,
	PointLight,
	Raycaster,
	RingGeometry,
	Scene,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
	TorusGeometry,
	Vector2,
	Vector3,
	type ColorRepresentation,
	type Material,
	type Object3D,
	type BufferGeometry as Geometry
} from 'three';
import { disposeObject } from '../../engine';
import { makeLabel, removeLabels, type Label } from '../../labels';
import type { Angles, LadderView } from '../../transitions';
import {
	bfs,
	EDGES,
	FLOOR_TILES,
	isWalk,
	NAV_SPOT,
	NAV_TILES,
	PROPS,
	REGIONS,
	rid,
	START,
	tileToWorld,
	worldToTile
} from './deckplan';
import { box, glowSprite, lam, LIGHT, pointsFrom, setInst, UP, type MockTextures } from './helpers';
import { mulberry32, type Rand } from './rng';

/** The deck camera's fixed tilt, carried to the orbit views as phi. */
export const ISO_PHI = Math.atan2(30, 24.5);

type Tile = [number, number];

interface Walker {
	g: Group;
	body: Mesh;
	path: Tile[];
	speed: number;
	wait: number;
}

/**
 * Mockup zoom 1: the demo ship's deck as an isometric cutaway (brief section
 * 6.4). Click-to-walk and the nav-station lock are the mockup's own rules,
 * never the game's.
 */
export class DeckView implements LadderView {
	readonly scene = new Scene();
	readonly camera = new OrthographicCamera(-10, 10, 10, -10, -300, 300);
	readonly labels: Label[] = [];
	/** The amber outline under the mouse. */
	readonly hover: LineLoop;
	yaw = Math.PI / 4;
	yawT = Math.PI / 4;
	#zoomF = 0.7;
	#driveZoom: number | null = null;
	readonly #reduceMotion: boolean;
	readonly #rand: Rand;
	readonly #stars: ReturnType<typeof pointsFrom>;
	readonly #player: Walker;
	readonly #npcs: Walker[];
	readonly #walkTiles: Tile[];
	readonly #dest: Mesh;
	readonly #tick: ((dt: number, t: number) => void)[] = [];
	readonly #ray = new Raycaster();
	readonly #deck = new Plane(UP, 0);
	readonly #hit = new Vector3();
	readonly #ndc = new Vector2();

	constructor(tex: MockTextures, labelLayer: HTMLElement, reduceMotion: boolean) {
		this.#reduceMotion = reduceMotion;
		const rand = mulberry32(42);
		this.#rand = rand;
		const scene = this.scene;

		scene.add(new AmbientLight(0x8a98bd, 0.62 * LIGHT));
		const sun = new DirectionalLight(0xffffff, 0.7 * LIGHT);
		sun.position.set(-8, 20, 10);
		scene.add(sun);
		const fill = new DirectionalLight(0x6f8fd0, 0.25 * LIGHT);
		fill.position.set(10, 6, -12);
		scene.add(fill);

		// Drifting stars below the ship: the ship is moving.
		const sp: number[] = [];
		const sc: number[] = [];
		const col = new Color();
		for (let i = 0; i < 900; i++) {
			sp.push((rand() * 2 - 1) * 120, -4 - rand() * 70, (rand() * 2 - 1) * 120);
			col.set(rand() < 0.2 ? 0xa9c4ff : 0xe6ebf5).multiplyScalar(0.35 + rand() * 0.6);
			sc.push(col.r, col.g, col.b);
		}
		this.#stars = pointsFrom(tex, sp, sc, 3);
		scene.add(this.#stars);

		// Hull slab and floor plates.
		const slab = new InstancedMesh(box, lam(0x1a2030), FLOOR_TILES.length);
		const floor = new InstancedMesh(box, lam(0xffffff), FLOOR_TILES.length);
		const fc = new Color();
		const p = new Vector3();
		FLOOR_TILES.forEach(([x, z], i) => {
			tileToWorld(x, z, p);
			setInst(slab, i, p.x, -0.36, p.z, 1, 0.6, 1);
			setInst(floor, i, p.x, -0.03, p.z, 0.98, 0.06, 0.98);
			fc.set(REGIONS[rid(x, z)].floor).multiplyScalar(
				((x + z) % 2 ? 1.0 : 1.12) * (0.95 + rand() * 0.08)
			);
			floor.setColorAt(i, fc);
		});
		if (floor.instanceColor) floor.instanceColor.needsUpdate = true;
		scene.add(slab, floor);

		// Thin walls on tile edges; doorways where a corridor meets a room.
		const T = 0.1;
		const WH = 0.84;
		const walls = EDGES.walls;
		const wall = new InstancedMesh(box, lam(0xffffff), walls.length);
		const cap = new InstancedMesh(box, lam(0xffffff), walls.length);
		walls.forEach(([x, z, dx, dz], i) => {
			tileToWorld(x, z, p);
			const mx = p.x + dx * 0.5;
			const mz = p.z + dz * 0.5;
			const sx = dx ? T : 1 + T;
			const sz = dx ? 1 + T : T;
			setInst(wall, i, mx, WH / 2, mz, sx, WH, sz);
			setInst(cap, i, mx, WH + 0.02, mz, sx + 0.04, 0.04, sz + 0.04);
			const bridge = REGIONS[rid(x, z)].name === 'Bridge';
			wall.setColorAt(i, fc.set(bridge ? 0x5d7486 : 0x6c768c).multiplyScalar(0.92 + rand() * 0.1));
			cap.setColorAt(i, fc.set(bridge ? 0x8fd9e0 : 0xa7b1c6));
		});
		if (wall.instanceColor) wall.instanceColor.needsUpdate = true;
		if (cap.instanceColor) cap.instanceColor.needsUpdate = true;
		scene.add(wall, cap);
		const postMat = lam(0x8a93a8);
		const stripMat = new MeshBasicMaterial({ color: 0x9a6f22 });
		for (const [x, z, dx, dz] of EDGES.doors) {
			tileToWorld(x, z, p);
			const mx = p.x + dx * 0.5;
			const mz = p.z + dz * 0.5;
			const strip = new Mesh(box, stripMat);
			strip.position.set(mx, 0.005, mz);
			strip.scale.set(dx ? 0.16 : 0.9, 0.02, dx ? 0.9 : 0.16);
			scene.add(strip);
			for (const o of [-0.5, 0.5]) {
				const post = new Mesh(box, postMat);
				post.scale.set(0.14, WH + 0.1, 0.14);
				post.position.set(mx + (dx ? 0 : o), (WH + 0.1) / 2, mz + (dx ? o : 0));
				scene.add(post);
			}
		}

		const add = (
			geo: Geometry,
			mat: Material,
			x: number,
			y: number,
			z: number,
			parent: Object3D = scene
		) => {
			const m = new Mesh(geo, mat);
			m.position.set(x, y, z);
			parent.add(m);
			return m;
		};

		// Cryo pods, where offline crew sleep.
		const podBase = lam(0x59627a);
		const lidMat = new MeshLambertMaterial({
			color: 0x6fd6d0,
			emissive: 0x1f6a66,
			transparent: true,
			opacity: 0.38,
			depthWrite: false
		});
		for (const [x, z] of PROPS.pods) {
			tileToWorld(x, z, p);
			add(new BoxGeometry(0.78, 0.34, 0.94), podBase, p.x, 0.17, p.z);
			const lid = add(new BoxGeometry(0.66, 0.28, 0.84), lidMat, p.x, 0.48, p.z);
			lid.renderOrder = 2;
		}
		const lockMat = lam(0x55607a);
		for (const [x, z] of PROPS.lockers) {
			tileToWorld(x, z, p);
			add(box, lockMat, p.x, 0.4, p.z + 0.2).scale.set(0.8, 0.8, 0.45);
		}
		// Crates.
		const crateMat = [lam(0x8a6a3c), lam(0x6f5a3f), lam(0x5f6b52)];
		PROPS.crates.forEach(([x, z], i) => {
			tileToWorld(x, z, p);
			const a = add(box, crateMat[i % 3], p.x, 0.32, p.z);
			a.scale.set(0.74, 0.64, 0.74);
			a.rotation.y = (rand() - 0.5) * 0.4;
			if (i % 2 === 0) {
				const b = add(box, crateMat[(i + 1) % 3], p.x + 0.05, 0.83, p.z - 0.04);
				b.scale.set(0.5, 0.38, 0.5);
				b.rotation.y = rand();
			}
		});
		// Mess tables and counter.
		const tabMat = lam(0x707a8e);
		for (const [x, z] of PROPS.tables) {
			tileToWorld(x, z, p);
			add(box, tabMat, p.x, 0.44, p.z).scale.set(0.92, 0.07, 0.92);
			add(new CylinderGeometry(0.06, 0.1, 0.42, 6), tabMat, p.x, 0.21, p.z);
			add(new CylinderGeometry(0.06, 0.06, 0.1, 6), lam(0xd98b2b), p.x + 0.2, 0.53, p.z - 0.15);
		}
		const counterMat = lam(0x5a6378);
		for (const [x, z] of PROPS.counter) {
			tileToWorld(x, z, p);
			add(box, counterMat, p.x, 0.3, p.z - 0.15).scale.set(1, 0.6, 0.6);
		}
		// Bridge seats, facing the nav console (+x).
		const seatMat = lam(0x3a4560);
		for (const [x, z] of PROPS.seats) {
			const g = new Group();
			tileToWorld(x, z, g.position);
			scene.add(g);
			add(new BoxGeometry(0.46, 0.08, 0.46), seatMat, 0, 0.3, 0, g);
			add(new BoxGeometry(0.07, 0.42, 0.46), seatMat, -0.22, 0.5, 0, g);
			add(new CylinderGeometry(0.05, 0.08, 0.26, 6), seatMat, 0, 0.13, 0, g);
		}
		// Consoles.
		const conMat = lam(0x3b4a5e);
		const smallConsole = (x: number, z: number, color: ColorRepresentation, faceX: number) => {
			tileToWorld(x, z, p);
			add(new BoxGeometry(0.7, 0.5, 0.7), conMat, p.x, 0.25, p.z);
			const s = add(new PlaneGeometry(0.55, 0.3), new MeshBasicMaterial({ color }), p.x, 0.62, p.z);
			s.rotation.set(0, faceX, 0);
			s.rotateX(-0.6);
		};
		smallConsole(7, 13, 0xf2a93b, -Math.PI / 2);
		smallConsole(24, 5, 0x6fd6d0, 0);
		smallConsole(24, 12, 0x6fd6d0, Math.PI);
		// The nav console.
		const navC = tileToWorld(28, 8).add(new Vector3(0, 0, 0.5));
		add(new BoxGeometry(0.9, 0.56, 1.8), conMat, navC.x, 0.28, navC.z);
		const screen = add(
			new PlaneGeometry(1.6, 0.5),
			new MeshBasicMaterial({ color: 0x6fd6d0 }),
			navC.x - 0.3,
			0.72,
			navC.z
		);
		screen.rotation.set(0, -Math.PI / 2, 0);
		screen.rotateX(-0.5);
		const holo = glowSprite(tex, 0x6fd6d0, 1.4, 0.8);
		holo.position.set(navC.x - 0.1, 1.25, navC.z);
		scene.add(holo);
		const navLight = new PointLight(0x6fd6d0, 1.0 * LIGHT, 7, 0);
		navLight.position.set(navC.x - 1.2, 1.4, navC.z);
		scene.add(navLight);
		const navRingMat = new MeshBasicMaterial({ color: 0x6fd6d0, transparent: true, opacity: 0.8 });
		const navRing = new Mesh(new RingGeometry(0.3, 0.4, 20), navRingMat);
		navRing.rotation.x = -Math.PI / 2;
		tileToWorld(NAV_SPOT[0], NAV_SPOT[1], p);
		navRing.position.set(p.x, 0.02, p.z);
		scene.add(navRing);
		// The reactor.
		const rc = tileToWorld(3, 14).add(new Vector3(0.5, 0, 0.5));
		add(new CylinderGeometry(0.85, 0.95, 0.2, 12), lam(0x3c4152), rc.x, 0.1, rc.z);
		const coreMat = new MeshBasicMaterial({ color: 0xffb45a });
		const core = add(new CylinderGeometry(0.34, 0.34, 1.1, 10), coreMat, rc.x, 0.75, rc.z);
		const ringMat = lam(0x7b8499);
		const rings = [0.45, 0.85, 1.2].map((y) => {
			const r = add(new TorusGeometry(0.55, 0.07, 6, 16), ringMat, rc.x, y, rc.z);
			r.rotation.x = Math.PI / 2;
			return r;
		});
		const reactorGlow = glowSprite(tex, 0xffa040, 3, 0.55);
		reactorGlow.position.set(rc.x, 0.8, rc.z);
		scene.add(reactorGlow);
		const reactorLight = new PointLight(0xffa040, 1.3 * LIGHT, 7, 0);
		reactorLight.position.set(rc.x + 0.5, 1.2, rc.z);
		scene.add(reactorLight);
		// Thrusters, just outside the engine room.
		const exhausts: Sprite[] = [];
		for (const z of [13, 16]) {
			tileToWorld(1, z, p);
			const noz = add(
				new CylinderGeometry(0.34, 0.5, 0.8, 10),
				lam(0x4a5264),
				p.x - 0.95,
				-0.2,
				p.z
			);
			noz.rotation.z = -Math.PI / 2;
			const g = glowSprite(tex, 0x8fc8ff, 2.2, 0.85);
			g.position.set(p.x - 1.65, -0.2, p.z);
			scene.add(g);
			exhausts.push(g);
		}

		// Characters.
		const skin = lam(0xd9b99b);
		const visorMat = new MeshBasicMaterial({ color: 0x1b2230 });
		const packMat = lam(0x2a3140);
		const makeChar = (color: ColorRepresentation) => {
			const g = new Group();
			const body = new Mesh(new CylinderGeometry(0.18, 0.22, 0.48, 8), lam(color));
			body.position.y = 0.3;
			const head = new Mesh(new SphereGeometry(0.16, 8, 6), skin);
			head.position.y = 0.69;
			const visor = new Mesh(new BoxGeometry(0.2, 0.06, 0.06), visorMat);
			visor.position.set(0, 0.71, 0.14);
			const pack = new Mesh(new BoxGeometry(0.22, 0.24, 0.1), packMat);
			pack.position.set(0, 0.36, -0.2);
			g.add(body, head, visor, pack);
			return { g, body };
		};
		const spawn = (color: ColorRepresentation, x: number, z: number, speed: number): Walker => {
			const { g, body } = makeChar(color);
			tileToWorld(x, z, g.position);
			scene.add(g);
			return { g, body, path: [], speed, wait: 1 + rand() * 3 };
		};
		this.#player = spawn(0xd9892b, START[0], START[1], 3.4);
		const pRing = new Mesh(
			new RingGeometry(0.28, 0.36, 20),
			new MeshBasicMaterial({ color: 0xf2a93b })
		);
		pRing.rotation.x = -Math.PI / 2;
		pRing.position.y = 0.02;
		this.#player.g.add(pRing);
		this.#npcs = [
			spawn(0x3fa38f, 14, 3, 1.8),
			spawn(0xb85c6e, 15, 14, 1.6),
			spawn(0x6a8fd6, 25, 9, 1.4)
		];
		const lp = new Vector3();
		this.labels.push(
			makeLabel(labelLayer, 'You', 'amber', () => lp.copy(this.#player.g.position).setY(1.05), 4)
		);

		// Sleepers in the pods, with rising z's.
		const zs: Sprite[] = [];
		const zBase = new Map<Sprite, { base: Vector3; phase: number }>();
		PROPS.sleepers.forEach(([x, z], i) => {
			tileToWorld(x, z, p);
			const { g } = makeChar(i ? 0x5c7fc0 : 0x8a74b8);
			g.scale.setScalar(0.85);
			g.rotation.x = -Math.PI / 2;
			g.position.set(p.x, 0.4, p.z + 0.36);
			scene.add(g);
			for (let k = 0; k < 3; k++) {
				const s = new Sprite(
					new SpriteMaterial({ map: tex.z, color: 0xbfeeea, transparent: true, depthWrite: false })
				);
				s.scale.set(0.34, 0.34, 1);
				zBase.set(s, { base: p.clone(), phase: k / 3 });
				scene.add(s);
				zs.push(s);
			}
		});
		tileToWorld(3, 1, p);
		this.labels.push(
			makeLabel(labelLayer, 'Offline crew, asleep', 'cyan', new Vector3(p.x, 1.3, p.z))
		);

		// Room names.
		for (const r of REGIONS) {
			if (r.kind !== 'room') continue;
			const c = tileToWorld(r.x, r.z).add(new Vector3((r.w - 1) / 2, 0, (r.h - 1) / 2));
			this.labels.push(makeLabel(labelLayer, r.name, 'quiet', new Vector3(c.x, 1.1, c.z), 2));
		}

		// Hover and destination markers.
		this.hover = new LineLoop(
			new BufferGeometry().setFromPoints([
				new Vector3(-0.46, 0, -0.46),
				new Vector3(0.46, 0, -0.46),
				new Vector3(0.46, 0, 0.46),
				new Vector3(-0.46, 0, 0.46)
			]),
			new LineBasicMaterial({ color: 0xf2a93b })
		);
		this.hover.position.y = 0.03;
		this.hover.visible = false;
		scene.add(this.hover);
		this.#dest = new Mesh(
			new OctahedronGeometry(0.14, 0),
			new MeshBasicMaterial({ color: 0xf2a93b })
		);
		this.#dest.visible = false;
		scene.add(this.#dest);

		this.#walkTiles = FLOOR_TILES.filter(([x, z]) => isWalk(x, z));

		// Animations that run whether or not the deck is shown.
		this.#tick.push((_dt, t) => {
			core.scale.y = 1 + Math.sin(t * 3) * 0.04;
			coreMat.color.setHSL(0.09, 1, 0.6 + Math.sin(t * 3) * 0.06);
			rings.forEach((r, i) => {
				r.rotation.z = t * (0.6 + i * 0.3) * (i % 2 ? -1 : 1);
			});
			reactorLight.intensity = (1.2 + Math.sin(t * 3) * 0.2) * LIGHT;
			holo.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.2;
			holo.position.y = 1.25 + Math.sin(t * 1.3) * 0.05;
			navRingMat.opacity = 0.5 + Math.sin(t * 3) * 0.3;
			exhausts.forEach((g, i) => {
				const k = 0.9 + Math.sin(t * 23 + i * 2) * 0.06 + Math.sin(t * 7 + i) * 0.05;
				g.scale.set(2.2 * k, 2.2 * k, 1);
			});
			for (const s of zs) {
				const d = zBase.get(s);
				if (!d) continue;
				const u = (t * 0.35 + d.phase) % 1;
				s.position.set(d.base.x + Math.sin(u * 6) * 0.12 + u * 0.3, 0.7 + u * 1.1, d.base.z);
				s.material.opacity = Math.sin(u * Math.PI) * 0.9;
			}
		});
	}

	/** Walks the player to a tile; false if it cannot be reached. */
	walkPlayer(tx: number, tz: number): boolean {
		const ok = this.#walk(this.#player, tx, tz);
		if (ok) {
			tileToWorld(tx, tz, this.#dest.position).setY(0.35);
			this.#dest.visible = true;
		}
		return ok;
	}

	/** Whether the player stands still on a nav tile. */
	atNav(): boolean {
		if (this.#player.path.length) return false;
		const [px, pz] = this.playerTile();
		return NAV_TILES.some(([x, z]) => x === px && z === pz);
	}

	playerTile(): Tile {
		return worldToTile(this.#player.g.position);
	}

	/** Q (−1) and E (+1): turn the camera 90°, eased. */
	rotate(k: number): void {
		this.yawT += (k * Math.PI) / 2;
	}

	/** The walkable tile under a point in normalised device coordinates, or null. */
	tileUnder(ndcX: number, ndcY: number): Tile | null {
		this.#ray.setFromCamera(this.#ndc.set(ndcX, ndcY), this.camera);
		if (!this.#ray.ray.intersectPlane(this.#deck, this.#hit)) return null;
		const t = worldToTile(this.#hit);
		return isWalk(t[0], t[1]) ? t : null;
	}

	/** Shows the hover outline on a tile, or hides it. */
	setHover(tile: Tile | null): void {
		this.hover.visible = tile !== null;
		if (tile) tileToWorld(tile[0], tile[1], this.hover.position).setY(0.03);
	}

	resize(width: number, height: number): void {
		const aspect = width / height;
		const halfH = Math.max(11, 19.5 / aspect);
		this.camera.left = -halfH * aspect;
		this.camera.right = halfH * aspect;
		this.camera.top = halfH;
		this.camera.bottom = -halfH;
		this.camera.updateProjectionMatrix();
	}

	enter(direction: 1 | -1): void {
		this.#zoomF = this.#reduceMotion ? 1 : direction < 0 ? 0.45 : 1.8;
	}

	angles(): Angles {
		return { theta: this.yaw, phi: ISO_PHI, idle: 0 };
	}

	takeAngles(a: Angles): void {
		// The carried heading may land between the 90° steps; Q/E turn from there.
		this.yaw = this.yawT = a.theta;
	}

	preMove(zoomingIn: boolean): void {
		this.#driveZoom = zoomingIn ? 3 : 0.4;
	}

	endPreMove(): void {
		this.#driveZoom = null;
	}

	update(dt: number, t: number, active: boolean): void {
		const pa = this.#stars.geometry.attributes.position;
		for (let i = 0; i < pa.count; i++) {
			let x = pa.getX(i) - dt * 2.2;
			if (x < -120) x += 240;
			pa.setX(i, x);
		}
		pa.needsUpdate = true;
		for (const f of this.#tick) f(dt, t);
		this.#step(this.#player, dt, t);
		if (!this.#player.path.length) this.#dest.visible = false;
		else this.#dest.rotation.y += dt * 3;
		for (const n of this.#npcs) {
			if (!this.#step(n, dt, t)) {
				n.wait -= dt;
				if (n.wait <= 0) {
					const [x, z] = this.#walkTiles[Math.floor(this.#rand() * this.#walkTiles.length)];
					this.#walk(n, x, z);
					n.wait = 2 + this.#rand() * 5;
				}
			}
		}
		if (!active) return;
		this.yaw += (this.yawT - this.yaw) * Math.min(1, dt * 6);
		const target = this.#driveZoom ?? 1;
		const rate = this.#driveZoom === null ? 3.2 : 7;
		this.#zoomF += (target - this.#zoomF) * (1 - Math.exp(-dt * rate));
		this.camera.zoom = this.#zoomF;
		this.camera.updateProjectionMatrix();
		this.camera.position.set(Math.sin(this.yaw) * 30, 24.5, Math.cos(this.yaw) * 30);
		this.camera.lookAt(0, 0, 0);
	}

	dispose(): void {
		disposeObject(this.scene);
		removeLabels(this.labels);
	}

	#walk(ch: Walker, tx: number, tz: number): boolean {
		const [sx, sz] = ch.path.length ? ch.path[0] : worldToTile(ch.g.position);
		const path = bfs(sx, sz, tx, tz);
		if (!path) return false;
		ch.path = ch.path.length ? [ch.path[0], ...path] : path;
		return true;
	}

	readonly #target = new Vector3();

	/** Moves a walker along its path; false when it stands still. */
	#step(ch: Walker, dt: number, t: number): boolean {
		if (!ch.path.length) {
			ch.body.position.y = 0.3;
			return false;
		}
		const [nx, nz] = ch.path[0];
		const tgt = tileToWorld(nx, nz, this.#target);
		const dx = tgt.x - ch.g.position.x;
		const dz = tgt.z - ch.g.position.z;
		const dist = Math.hypot(dx, dz);
		const s = ch.speed * dt;
		if (dist <= s) {
			ch.g.position.x = tgt.x;
			ch.g.position.z = tgt.z;
			ch.path.shift();
		} else {
			ch.g.position.x += (dx / dist) * s;
			ch.g.position.z += (dz / dist) * s;
		}
		if (dist > 0.001) {
			let d = Math.atan2(dx, dz) - ch.g.rotation.y;
			d = Math.atan2(Math.sin(d), Math.cos(d));
			ch.g.rotation.y += d * Math.min(1, dt * 14);
		}
		ch.body.position.y = 0.3 + Math.abs(Math.sin(t * 13)) * 0.035;
		return true;
	}
}
