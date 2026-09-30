import { AdditiveBlending, Color, Sprite, SpriteMaterial, Vector3, type Scene } from 'three';
import { glowSprite, placed, pointsFrom, ringSprite, type MockTextures } from './helpers';
import { gauss, type Rand } from './rng';

/** Star colours by cumulative share: mostly red dwarfs, a few hot blue stars. */
const STAR_TYPES: readonly [number, number][] = [
	[0.7, 0xff9a6a],
	[0.82, 0xffc38a],
	[0.9, 0xfff0c8],
	[0.95, 0xf4f6ff],
	[1.0, 0xa9c4ff]
];

export const RED_DWARF = 0xff9a6a;

/** Sets c to a random star colour from the spectral mix. */
export function starColor(rand: Rand, c: Color): Color {
	const k = rand();
	return c.set((STAR_TYPES.find((t) => k <= t[0]) ?? STAR_TYPES[4])[1]);
}

/**
 * The "you are here" marker: an amber glow and a ring that expands and
 * fades in a loop. Returns its animation.
 */
export function youMarker(
	tex: MockTextures,
	scene: Scene,
	pos: Vector3,
	size: number
): (t: number) => void {
	const dot = placed(glowSprite(tex, 0xf2a93b, size, 1), pos);
	const ring = placed(ringSprite(tex, 0xf2a93b, size), pos);
	scene.add(dot, ring);
	return (t) => {
		const u = (t * 0.5) % 1;
		const s = size * (0.8 + u * 2.6);
		ring.scale.set(s, s, 1);
		ring.material.opacity = 1 - u;
		dot.material.opacity = 0.7 + Math.sin(t * 5) * 0.3;
	};
}

/**
 * A Hydra node's range as a heat haze with no hard edge; with cloud, also a
 * Gaussian cloud of points, brighter and cyan near the centre.
 */
export function hydraHaze(
	tex: MockTextures,
	rand: Rand,
	scene: Scene,
	p: Vector3,
	radius: number,
	cloud: boolean
): void {
	const haze = new Sprite(
		new SpriteMaterial({
			map: tex.heat,
			transparent: true,
			opacity: 0.6,
			blending: AdditiveBlending,
			depthWrite: false
		})
	);
	haze.position.copy(p);
	haze.scale.set(radius * 2.8, radius * 2.8, 1);
	scene.add(haze);
	if (cloud) {
		const hp: number[] = [];
		const hc: number[] = [];
		const col = new Color();
		const d = new Vector3();
		for (let i = 0; i < 1600; i++) {
			d.set(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(radius * 0.4);
			const f = Math.min(1, d.length() / (radius * 1.2));
			hp.push(p.x + d.x, p.y + d.y, p.z + d.z);
			col.setHSL(0.47 + f * 0.12, 0.7, 0.62 - f * 0.3).multiplyScalar(0.55 * (1 - f) + 0.08);
			hc.push(col.r, col.g, col.b);
		}
		scene.add(pointsFrom(tex, hp, hc, 3, { blending: AdditiveBlending, opacity: 0.8 }));
	}
	scene.add(placed(glowSprite(tex, 0xdffcf8, Math.max(8, radius * 0.35), 1), p));
}

/** A Gaussian cloud of coloured points, for nebulae and gas clouds. */
export function cloudOf(
	tex: MockTextures,
	rand: Rand,
	scene: Scene,
	center: Vector3,
	n: number,
	spread: Vector3,
	hues: readonly number[],
	size = 3
): void {
	const p: number[] = [];
	const c: number[] = [];
	const col = new Color();
	for (let i = 0; i < n; i++) {
		p.push(
			center.x + gauss(rand) * spread.x,
			center.y + gauss(rand) * spread.y,
			center.z + gauss(rand) * spread.z
		);
		col.setHSL(hues[Math.floor(rand() * hues.length)], 0.65, 0.35 + rand() * 0.25);
		c.push(col.r, col.g, col.b);
	}
	scene.add(pointsFrom(tex, p, c, size, { blending: AdditiveBlending, opacity: 0.55 }));
}
