import {
	AdditiveBlending,
	BoxGeometry,
	Color,
	EdgesGeometry,
	GridHelper,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	Vector3
} from 'three';
import { childInBox } from '../../cubes';
import { makeLabel } from '../../labels';
import { YOU } from './data';
import { dashed, glowSprite, placed, pointsFrom, starShell, type MockTextures } from './helpers';
import { OrbitView } from './OrbitView';
import { gauss, mulberry32, type Rand } from './rng';
import { cloudOf, hydraHaze, RED_DWARF, starColor, youMarker } from './space';

/** Every nested level is a box 1,000 units across, divided 10 × 10 × 10. */
const BOX = 1000;
const CELL = 100;
const ROUTE_DIR = new Vector3(180, 40, -120).normalize();

type Level = 3 | 4 | 5;

/** What differs between zooms 3, 4 and 5 (brief section 6.6). */
const LEVELS: Record<Level, { seed: number; cubeLy: number; child: string; scale: string }> = {
	3: { seed: 11, cubeLy: 10, child: 'You · 10 ly cube', scale: '100 ly' },
	4: { seed: 5, cubeLy: 100, child: 'You · 100 ly cube', scale: '1,000 ly' },
	5: { seed: 21, cubeLy: 1000, child: 'You · 1,000 ly cube', scale: '10,000 ly' }
};

/**
 * Mockup zooms 3 to 5, one class in three configurations: a box of 10 × 10
 * × 10 cubes with your cube outlined in amber; that cube is the whole box
 * of the zoom below (ADR 053).
 */
export class NestedView extends OrbitView {
	readonly focus: Vector3;
	readonly diveFactor = 0.06;
	readonly #marker: (t: number) => void;

	constructor(level: Level, tex: MockTextures, labelLayer: HTMLElement, reduceMotion: boolean) {
		const cfg = LEVELS[level];
		const child = childInBox(YOU, cfg.cubeLy);
		const cc = new Vector3(
			-BOX / 2 + (child[0] + 0.5) * CELL,
			-BOX / 2 + (child[1] + 0.5) * CELL,
			-BOX / 2 + (child[2] + 0.5) * CELL
		);
		super(
			{ radius: 1750, phi: 1.12, theta: 0.35 + level * 0.2, auto: 0.035 },
			30000,
			1,
			62,
			{ out: { factor: 0.14, target: cc }, in: { factor: 2.4, target: new Vector3() } },
			reduceMotion
		);
		this.focus = cc;
		const rand = mulberry32(cfg.seed);
		const scene = this.scene;

		scene.add(starShell(tex, rand, 1200, 9000, 10000, 3));
		// The outer box and the 10 × 10 grid on its floor.
		scene.add(
			new LineSegments(
				new EdgesGeometry(new BoxGeometry(BOX, BOX, BOX)),
				new LineBasicMaterial({ color: 0x3a4d78 })
			)
		);
		const grid = new GridHelper(BOX, 10, 0x2c4a5a, 0x1c2a40);
		grid.position.y = -BOX / 2;
		scene.add(grid);
		// The cube you are in.
		const cg = new BoxGeometry(CELL, CELL, CELL);
		scene.add(
			placed(
				new LineSegments(new EdgesGeometry(cg), new LineBasicMaterial({ color: 0xf2a93b })),
				cc
			)
		);
		scene.add(
			placed(
				new Mesh(
					cg,
					new MeshBasicMaterial({
						color: 0xf2a93b,
						transparent: true,
						opacity: 0.07,
						depthWrite: false
					})
				),
				cc
			)
		);
		scene.add(
			dashed(
				new Vector3(cc.x, cc.y - CELL / 2, cc.z),
				new Vector3(cc.x, -BOX / 2, cc.z),
				0xf2a93b,
				12,
				10,
				0.45
			)
		);
		this.labels.push(
			makeLabel(labelLayer, cfg.child, 'amber', new Vector3(cc.x, cc.y + CELL / 2, cc.z))
		);
		this.labels.push(
			makeLabel(labelLayer, cfg.scale, 'cyan', new Vector3(0, -BOX / 2, BOX / 2), -6)
		);

		const fill = { 3: this.#neighbourhood, 4: this.#localCell, 5: this.#region }[level];
		this.#marker = fill.call(this, tex, rand, labelLayer, cc);
	}

	protected animate(_dt: number, t: number): void {
		this.#marker(t);
	}

	/** Zoom 3: 100 ly, stars spread evenly, the route and two Hydra nodes. */
	#neighbourhood(tex: MockTextures, rand: Rand, layer: HTMLElement, cc: Vector3) {
		const scene = this.scene;
		const pd: number[] = [];
		const cd: number[] = [];
		const pb: number[] = [];
		const cb: number[] = [];
		const c = new Color();
		for (let i = 0; i < 900; i++) {
			const p = [(rand() - 0.5) * BOX, (rand() - 0.5) * BOX, (rand() - 0.5) * BOX];
			starColor(rand, c);
			const bright = c.getHex() !== RED_DWARF && rand() < 0.5;
			if (!bright) c.multiplyScalar(0.55 + rand() * 0.35);
			(bright ? pb : pd).push(p[0], p[1], p[2]);
			(bright ? cb : cd).push(c.r, c.g, c.b);
		}
		scene.add(pointsFrom(tex, pd, cd, 3));
		scene.add(pointsFrom(tex, pb, cb, 6));
		scene.add(placed(glowSprite(tex, 0xffd9a0, 34, 1), cc));
		const dest = cc.clone().add(ROUTE_DIR.clone().multiplyScalar(220));
		scene.add(placed(glowSprite(tex, 0xf4f6ff, 40, 1), dest));
		scene.add(dashed(cc, dest, 0xf2a93b, 14, 10, 0.95));
		this.labels.push(
			makeLabel(layer, 'Destination · 22 ly', 'amber', dest.clone().add(new Vector3(0, 14, 0)))
		);
		for (const o of [new Vector3(-160, 20, 110), new Vector3(150, -40, 190)]) {
			const p = cc.clone().add(o);
			hydraHaze(tex, rand, scene, p, 85, true);
			this.labels.push(
				makeLabel(layer, 'Hydra node · 8.5 ly range', 'cyan', p.clone().add(new Vector3(0, 16, 0)))
			);
		}
		return youMarker(tex, scene, cc, 16);
	}

	/** Zoom 4: 1,000 ly, stars crowding the floor, a nebula, small Hydra nodes. */
	#localCell(tex: MockTextures, rand: Rand, layer: HTMLElement, cc: Vector3) {
		const scene = this.scene;
		const p: number[] = [];
		const c: number[] = [];
		const col = new Color();
		for (let i = 0; i < 4200; i++) {
			const x = (rand() - 0.5) * BOX;
			const y = Math.min(490, -498 + Math.abs(gauss(rand)) * 380);
			const z = (rand() - 0.5) * BOX;
			p.push(x, y, z);
			starColor(rand, col).multiplyScalar(0.35 + rand() * 0.55);
			c.push(col.r, col.g, col.b);
		}
		scene.add(pointsFrom(tex, p, c, 3));
		// An uncharted nebula.
		const neb = new Vector3(-220, -400, -200);
		cloudOf(tex, rand, scene, neb, 3200, new Vector3(95, 35, 70), [0.88, 0.92, 0.78, 0.5]);
		scene.add(placed(glowSprite(tex, 0xb0508f, 460, 0.28), neb));
		this.labels.push(
			makeLabel(layer, 'Nebula · uncharted', 'quiet', neb.clone().add(new Vector3(0, 110, 0)))
		);
		// Hydra nodes are small, scattered points at this scale.
		[
			new Vector3(10, 10, 90),
			new Vector3(260, -120, -60),
			new Vector3(-120, 30, 330),
			new Vector3(330, 80, 280)
		].forEach((o, i) => {
			const q = cc.clone().add(o).clampScalar(-480, 480);
			hydraHaze(tex, rand, scene, q, 9, false);
			if (i < 2) {
				this.labels.push(
					makeLabel(layer, 'Hydra node', 'cyan', q.clone().add(new Vector3(0, 8, 0)))
				);
			}
		});
		return youMarker(tex, scene, cc, 14);
	}

	/** Zoom 5: 10,000 ly of the upper disc, stars thick on the floor, gas clouds. */
	#region(tex: MockTextures, rand: Rand, layer: HTMLElement, cc: Vector3) {
		const scene = this.scene;
		const p: number[] = [];
		const c: number[] = [];
		const col = new Color();
		for (let i = 0; i < 14000; i++) {
			const disc = rand() < 0.82;
			const x = (rand() - 0.5) * BOX;
			const y = Math.min(495, -498 + Math.abs(gauss(rand)) * (disc ? 70 : 260));
			const z = (rand() - 0.5) * BOX;
			p.push(x, y, z);
			starColor(rand, col).multiplyScalar((disc ? 0.45 : 0.25) + rand() * 0.45);
			c.push(col.r, col.g, col.b);
		}
		scene.add(pointsFrom(tex, p, c, 2.6, { blending: AdditiveBlending, opacity: 0.85 }));
		cloudOf(
			tex,
			rand,
			scene,
			new Vector3(-280, -470, 200),
			1400,
			new Vector3(110, 16, 60),
			[0.92, 0.95]
		);
		cloudOf(
			tex,
			rand,
			scene,
			new Vector3(250, -475, -260),
			1200,
			new Vector3(80, 14, 120),
			[0.58, 0.62]
		);
		cloudOf(
			tex,
			rand,
			scene,
			new Vector3(120, -480, 330),
			900,
			new Vector3(60, 12, 50),
			[0.88, 0.6]
		);
		this.labels.push(
			makeLabel(layer, 'Galactic plane', 'quiet', new Vector3(BOX / 2, -BOX / 2, -BOX / 2))
		);
		return youMarker(tex, scene, cc, 12);
	}
}
