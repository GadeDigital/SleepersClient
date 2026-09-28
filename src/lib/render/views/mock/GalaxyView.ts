import {
	AdditiveBlending,
	BoxGeometry,
	BufferGeometry,
	Color,
	EdgesGeometry,
	Float32BufferAttribute,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	Vector3
} from 'three';
import { cubeIndex } from '../../cubes';
import { makeLabel } from '../../labels';
import { YOU } from './data';
import { glowSprite, placed, pointsFrom, starShell, type MockTextures } from './helpers';
import { OrbitView } from './OrbitView';
import { gauss, mulberry32 } from './rng';
import { youMarker } from './space';

/** Light-years per scene unit: 100, so the galaxy is 1,000 units across. */
const LY = 100;
/** One 10,000 ly cube, in scene units. */
const C = 100;
const HALF = 500;

/** Your position in the scene: scene X = x, scene Y = z (height), scene Z = y. */
const YOU_SCENE = new Vector3(YOU.x / LY, YOU.z / LY, YOU.y / LY);

/**
 * Mockup zoom 6: the Milky Way at full scale, 100,000 × 100,000 × 20,000 ly,
 * framed in 10 × 10 × 2 cubes of 10,000 ly (brief section 6.7).
 */
export class GalaxyView extends OrbitView {
	readonly focus = YOU_SCENE;
	readonly diveFactor = 0.07;
	readonly #marker: (t: number) => void;

	constructor(tex: MockTextures, labelLayer: HTMLElement, reduceMotion: boolean) {
		super(
			{ radius: 1650, phi: 0.95, theta: 0.3, auto: 0.025, maxPhi: 1.52 },
			30000,
			1,
			64,
			{ out: { factor: 0.1, target: YOU_SCENE }, in: { factor: 2.2, target: new Vector3() } },
			reduceMotion
		);
		const rand = mulberry32(99);
		const scene = this.scene;
		scene.add(starShell(tex, rand, 1200, 8000, 9000, 3));

		// Bulge, four logarithmic spiral arms and a thick background disc.
		const p: number[] = [];
		const c: number[] = [];
		const col = new Color();
		for (let i = 0; i < 75000; i++) {
			const k = rand();
			if (k < 0.16) {
				const r = Math.abs(gauss(rand)) * 55;
				const th = rand() * Math.PI * 2;
				p.push(r * Math.cos(th), gauss(rand) * (38 + 30 * Math.exp(-r / 60)), r * Math.sin(th));
				col.setHSL(0.09 + rand() * 0.03, 0.8, 0.55 + rand() * 0.25);
			} else if (k < 0.82) {
				const arm = i % 4;
				const r = 45 + Math.pow(rand(), 0.85) * 530;
				const th = (arm * Math.PI) / 2 + Math.log(r / 30) * 2.05 + gauss(rand) * (0.22 + 18 / r);
				const x = r * Math.cos(th) + gauss(rand) * 8;
				const y = gauss(rand) * (30 + 22 * Math.exp(-r / 200));
				const z = r * Math.sin(th) + gauss(rand) * 8;
				p.push(x, y, z);
				const q = rand();
				if (q < 0.04) col.setHSL(0.95, 0.7, 0.62);
				else if (q < 0.55) col.setHSL(0.6, 0.45, 0.62 + rand() * 0.2);
				else col.setHSL(0.1, 0.3, 0.45 + rand() * 0.3);
				col.multiplyScalar(0.5 + Math.max(0, 1 - r / 600) * 0.5);
			} else {
				const r = Math.sqrt(rand()) * 570;
				const th = rand() * Math.PI * 2;
				p.push(r * Math.cos(th), gauss(rand) * 34, r * Math.sin(th));
				col.setHSL(0.1, 0.2, 0.3 + rand() * 0.2);
			}
			c.push(col.r, col.g, col.b);
		}
		scene.add(pointsFrom(tex, p, c, 2.6, { blending: AdditiveBlending, opacity: 0.85 }));
		scene.add(glowSprite(tex, 0xffcf8a, 380, 0.55));
		this.labels.push(makeLabel(labelLayer, 'Galactic core', 'quiet', new Vector3(0, 40, 0)));

		// The frame: 10 × 10 × 2 cubes of 10,000 ly.
		const lv: number[] = [];
		for (let i = 0; i <= 10; i++) {
			for (let j = 0; j <= 10; j++) {
				const x = -HALF + i * C;
				const z = -HALF + j * C;
				lv.push(x, -C, z, x, C, z);
			}
		}
		for (const y of [-C, 0, C]) {
			for (let i = 0; i <= 10; i++) {
				const v = -HALF + i * C;
				lv.push(v, y, -HALF, v, y, HALF, -HALF, y, v, HALF, y, v);
			}
		}
		const fg = new BufferGeometry();
		fg.setAttribute('position', new Float32BufferAttribute(lv, 3));
		scene.add(
			new LineSegments(
				fg,
				new LineBasicMaterial({ color: 0x3a4d78, transparent: true, opacity: 0.35 })
			)
		);

		// Your 10,000 ly cube, from the nested-cube maths (ADR 054).
		const [ix, iy, iz] = cubeIndex(YOU, 10_000);
		const hc = new Vector3((ix + 0.5) * C, (iz + 0.5) * C, (iy + 0.5) * C);
		const hg = new BoxGeometry(C, C, C);
		scene.add(
			placed(
				new LineSegments(new EdgesGeometry(hg), new LineBasicMaterial({ color: 0xf2a93b })),
				hc
			)
		);
		scene.add(
			placed(
				new Mesh(
					hg,
					new MeshBasicMaterial({
						color: 0xf2a93b,
						transparent: true,
						opacity: 0.1,
						depthWrite: false
					})
				),
				hc
			)
		);
		this.labels.push(
			makeLabel(
				labelLayer,
				'You · 10,000 ly region',
				'amber',
				new Vector3(hc.x, hc.y + C / 2, hc.z)
			)
		);
		this.#marker = youMarker(tex, scene, YOU_SCENE, 16);
		this.labels.push(makeLabel(labelLayer, '100,000 ly', 'quiet', new Vector3(0, -C, HALF), -8));
		this.labels.push(makeLabel(labelLayer, '20,000 ly', 'quiet', new Vector3(-HALF, 0, HALF)));
	}

	protected animate(_dt: number, t: number): void {
		this.#marker(t);
	}
}
