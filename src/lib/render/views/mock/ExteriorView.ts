import {
	AdditiveBlending,
	AmbientLight,
	BackSide,
	DirectionalLight,
	IcosahedronGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	SphereGeometry,
	Vector3,
	type Points
} from 'three';
import { canvasTexture } from '../../textures';
import { makeLabel } from '../../labels';
import { tileToWorld } from './deckplan';
import { glowSprite, LIGHT, placed, pointsFrom, starShell, type MockTextures } from './helpers';
import { buildHull, type Hull } from './hull';
import { OrbitView } from './OrbitView';
import { mulberry32 } from './rng';

/**
 * Mockup zoom 2: your ship from outside, its hull generated from the deck
 * plan, with the local star, a planet and its moon (brief section 6.5).
 */
export class ExteriorView extends OrbitView {
	readonly focus = new Vector3();
	readonly diveFactor = 0.12;
	readonly #hull: Hull;
	readonly #planet: Mesh;
	readonly #moon: Mesh;
	readonly #dust: Points;
	readonly #shipLabel = new Vector3();

	constructor(tex: MockTextures, labelLayer: HTMLElement, reduceMotion: boolean) {
		super(
			{ radius: 58, phi: 1.08, theta: 0.95, auto: 0.06 },
			6000,
			0.5,
			60,
			{ out: { factor: 0.28, target: null }, in: { factor: 2.6, target: null } },
			reduceMotion
		);
		const rand = mulberry32(7);
		const scene = this.scene;

		scene.add(starShell(tex, rand, 1600, 2500, 3000, 3));
		scene.add(new AmbientLight(0x5a6a90, 0.5 * LIGHT));
		const starPos = new Vector3(900, 260, -1300);
		const sunLight = new DirectionalLight(0xfff0d8, 1.2 * LIGHT);
		sunLight.position.copy(starPos);
		scene.add(sunLight);
		const rim = new DirectionalLight(0x5f8fff, 0.35 * LIGHT);
		rim.position.set(-400, -100, 500);
		scene.add(rim);
		scene.add(placed(glowSprite(tex, 0xffd9a0, 520, 0.9), starPos));
		scene.add(placed(glowSprite(tex, 0xffffff, 120, 1), starPos));
		this.labels.push(
			makeLabel(labelLayer, 'Local star', 'quiet', starPos.clone().add(new Vector3(0, 70, 0)))
		);

		// A planet with a chunky pixel texture.
		const planetTex = canvasTexture(
			128,
			64,
			(g, w, h) => {
				const pal = ['#2f4b57', '#3f6468', '#6c7a5c', '#9a8a5e', '#b8a57a'];
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						const n =
							Math.sin(y * 0.42 + Math.sin(x * 0.11) * 1.8) +
							0.6 * Math.sin(x * 0.19 + y * 0.07) +
							0.35 * Math.sin(x * 0.53 - y * 0.31);
						const k = Math.max(
							0,
							Math.min(pal.length - 1, Math.floor(((n + 1.9) / 3.8) * pal.length))
						);
						g.fillStyle = pal[k];
						g.fillRect(x, y, 1, 1);
					}
				}
			},
			true
		);
		this.#planet = new Mesh(
			new SphereGeometry(95, 40, 28),
			new MeshLambertMaterial({ map: planetTex })
		);
		this.#planet.position.set(-190, -70, -330);
		this.#planet.rotation.z = 0.35;
		scene.add(this.#planet);
		const atmo = new Mesh(
			new SphereGeometry(101, 40, 28),
			new MeshBasicMaterial({
				color: 0x6fb6d6,
				transparent: true,
				opacity: 0.12,
				blending: AdditiveBlending,
				side: BackSide,
				depthWrite: false
			})
		);
		atmo.position.copy(this.#planet.position);
		scene.add(atmo);
		this.#moon = new Mesh(
			new IcosahedronGeometry(9, 1),
			new MeshLambertMaterial({ color: 0x8c8a86, flatShading: true })
		);
		scene.add(this.#moon);
		this.labels.push(
			makeLabel(
				labelLayer,
				'Planet · unscanned',
				'cyan',
				this.#planet.position.clone().add(new Vector3(0, 105, 0))
			)
		);

		this.#hull = buildHull(tex, rand);
		scene.add(this.#hull.ship);
		const labelX = tileToWorld(12, 8).x;
		const labelZ = tileToWorld(0, 8).z;
		this.labels.push(
			makeLabel(labelLayer, 'Your ship', 'amber', () =>
				this.#shipLabel.set(labelX, 1.6 + this.#hull.ship.position.y, labelZ)
			)
		);

		// Fine dust streaming past: the ship is moving.
		const dp: number[] = [];
		for (let i = 0; i < 500; i++) {
			dp.push((rand() * 2 - 1) * 80, (rand() * 2 - 1) * 40, (rand() * 2 - 1) * 80);
		}
		this.#dust = pointsFrom(tex, dp, null, 3, { color: 0x8290ad, opacity: 0.55 });
		scene.add(this.#dust);
	}

	protected animate(dt: number, t: number): void {
		const h = this.#hull;
		h.ship.position.y = Math.sin(t * 0.6) * 0.3;
		h.ship.rotation.x = Math.sin(t * 0.4) * 0.02;
		h.flames.forEach((f, i) => {
			const k = 0.85 + Math.sin(t * 29 + i * 1.7) * 0.08 + Math.sin(t * 9 + i) * 0.07;
			f.plume.scale.y = k;
			(f.plume.material as MeshBasicMaterial).opacity = 0.34 + Math.sin(t * 17 + i) * 0.06;
			const s = 4 * (0.92 + k * 0.1);
			f.glow.scale.set(s, s, 1);
		});
		h.port.material.opacity = h.starboard.material.opacity = Math.sin(t * 2) > 0.2 ? 1 : 0.25;
		h.strobe.material.opacity = t % 1.6 < 0.08 ? 1 : 0;
		h.dish.rotation.y = t * 0.5;
		this.#planet.rotation.y = t * 0.01;
		const pp = this.#planet.position;
		this.#moon.position.set(
			pp.x + Math.cos(t * 0.05) * 160,
			pp.y + 20,
			pp.z + Math.sin(t * 0.05) * 160
		);
		const pa = this.#dust.geometry.attributes.position;
		for (let i = 0; i < pa.count; i++) {
			let x = pa.getX(i) - dt * 22;
			if (x < -80) x += 160;
			pa.setX(i, x);
		}
		pa.needsUpdate = true;
	}
}
