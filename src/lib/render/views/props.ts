import { Color } from 'three';
import type { Prop } from '$lib/proto/sleepers/v1/world_pb';
import { Batch, noise, shape } from './batch';

/**
 * How a map's props look (ADR 074). The server says only what stands where
 * and how big it is; the look of each kind is the client's. Everything is
 * built in map coordinates, tile (x, y) spanning x to x+1 and y to y+1,
 * into a few batches.
 */
export interface PropBatches {
	/** Lit by the scene's lights. */
	box: Batch;
	cylinder: Batch;
	/** Glowing: windows, screens, lamp heads; unlit. */
	glowBox: Batch;
	glowCylinder: Batch;
	/** Soft pools of light on the ground, added to what is under them. */
	pool: Batch;
}

export function propBatches(): PropBatches {
	return {
		box: new Batch(),
		cylinder: new Batch(),
		glowBox: new Batch(),
		glowCylinder: new Batch(),
		pool: new Batch()
	};
}

/** A lamp, for the few real lights that follow the camera. */
export interface Lamp {
	x: number;
	y: number;
	z: number;
	colour: number;
}

/** A prop's name, shown over it. */
export interface PropLabel {
	text: string;
	kind: string;
	x: number;
	y: number;
	z: number;
}

/** How high one height level stands, in tiles (ADR 065). */
export const LEVEL = 0.5;

const SODIUM = 0xffa04a;
const COLD = 0x9cc8ff;
const HYDRA = 0x4fd6d0;

/** Dark, weathered facades. */
const FACADES = [0x24272d, 0x2b2c30, 0x202329, 0x2e2a27, 0x272a2a];
const AWNINGS = [0x4a2a28, 0x2c3a2c, 0x3a3428, 0x2a3040];

const c = new Color();

/**
 * Adds one prop standing on ground height g. Returns the lamp it carries,
 * if any.
 */
export function addProp(b: PropBatches, p: Prop, g: number, labels: PropLabel[]): Lamp | null {
	const w = Math.max(1, p.width);
	const d = Math.max(1, p.depth);
	const h = p.height / 10;
	const cx = p.x + w / 2;
	const cz = p.y + d / 2;
	const n = noise(p.x, p.y, 7);
	// Long things lie along their longer side; a quarter turn flips the nose.
	const along = w >= d;
	const flip = p.rotation >= 2 ? -1 : 1;
	let top = g + h;
	let lamp: Lamp | null = null;

	switch (p.kind) {
		case 'building':
		case 'exchange':
		case 'hydra-facility': {
			const colour =
				p.kind === 'exchange'
					? 0x34312c
					: p.kind === 'hydra-facility'
						? 0x3a4145
						: FACADES[Math.floor(n * FACADES.length)];
			b.box.add(shape(cx, g + h / 2, cz, w - 0.1, h, d - 0.1), colour);
			b.box.add(
				shape(cx, g + h + 0.06, cz, w + 0.1, 0.12, d + 0.1),
				c.set(colour).multiplyScalar(1.3)
			);
			const lit = p.kind === 'exchange' ? 0.45 : p.kind === 'hydra-facility' ? 0.3 : 0.1;
			const warm = p.kind === 'hydra-facility' ? COLD : 0xd9a24a;
			windows(b, p.x, p.y, w, d, g, h, lit, warm);
			if (p.kind === 'hydra-facility') {
				// The company's cyan band, the only clean colour in town.
				b.glowBox.add(
					shape(cx, g + 1.1, cz, w - 0.06, 0.08, d - 0.06),
					c.set(HYDRA).multiplyScalar(0.7)
				);
			}
			if (p.kind === 'exchange') {
				b.glowBox.add(
					shape(cx, g + 1.05, p.y + d - 0.02, Math.min(4, w * 0.3), 0.1, 0.06),
					c.set(SODIUM).multiplyScalar(0.8)
				);
			}
			break;
		}
		case 'stall': {
			const awning = AWNINGS[Math.floor(n * AWNINGS.length)];
			b.box.add(shape(cx, g + 0.45, cz, w - 0.2, 0.9, d - 0.3), 0x3a332b);
			for (const [px, pz] of corners(p.x, p.y, w, d, 0.15)) {
				b.box.add(shape(px, g + 0.8, pz, 0.06, 1.6, 0.06), 0x2a2622);
			}
			b.box.add(shape(cx, g + 1.62, cz, w, 0.06, d), awning);
			if (n > 0.4)
				b.glowBox.add(shape(cx, g + 1.5, cz, 0.12, 0.12, 0.12), c.set(SODIUM).multiplyScalar(0.7));
			top = g + 1.7;
			break;
		}
		case 'plinth': {
			b.box.add(shape(cx, g + 0.5, cz, w - 0.2, 1, d - 0.2), 0x3a3836);
			b.cylinder.add(shape(cx, g + 1.8, cz, 0.35, 1.6, 0.35), 0x4a4c48);
			top = g + 2.6;
			break;
		}
		case 'lamp-sodium':
		case 'lamp-cold': {
			const colour = p.kind === 'lamp-sodium' ? SODIUM : COLD;
			const lx = p.x + 0.5;
			const lz = p.y + 0.5;
			b.cylinder.add(shape(lx, g + 1.2, lz, 0.1, 2.4, 0.1), 0x1c1e22);
			b.glowBox.add(shape(lx, g + 2.42, lz, 0.28, 0.1, 0.28), colour);
			lamp = { x: lx, y: g + 2.3, z: lz, colour };
			// Its pool of light on the ground: the only way to see far at night.
			b.pool.add(shape(lx, g + 0.02, lz, 7, 1, 7), c.set(colour).multiplyScalar(0.45));
			top = g + 2.5;
			break;
		}
		case 'guard-booth': {
			b.box.add(shape(cx, g + 1.1, cz, w - 0.2, 2.2, d - 0.2), 0x353832);
			b.box.add(shape(cx, g + 2.26, cz, w + 0.1, 0.12, d + 0.1), 0x2a2c28);
			b.glowBox.add(
				shape(cx, g + 1.4, cz, w - 0.14, 0.4, d - 0.14),
				c.set(0xd9a24a).multiplyScalar(0.6)
			);
			top = g + 2.3;
			break;
		}
		case 'tower': {
			b.box.add(shape(cx, g + h / 2, cz, 0.7, h, 0.7), 0x26282c);
			for (let y = 2; y < h - 1; y += 2.5) b.box.add(shape(cx, g + y, cz, 1.1, 0.1, 1.1), 0x303236);
			b.glowBox.add(shape(cx, g + h + 0.1, cz, 0.2, 0.2, 0.2), 0xd0302a);
			break;
		}
		case 'ship':
		case 'ship-wreck': {
			const wreck = p.kind === 'ship-wreck';
			const len = along ? w : d;
			const wide = along ? d : w;
			const ry = along ? 0 : Math.PI / 2;
			const tilt = wreck ? 0.12 * flip : 0;
			const hull = wreck ? 0x2a2826 : 0x3b3f45;
			const hh = Math.max(1.2, h * 0.55);
			// Hull, a narrower nose and a raised bridge; the nose points east, or
			// south when the ship lies north to south, flipped by the turns.
			const nose = flip * len * 0.4;
			const at = (u: number): [number, number] => (along ? [cx + u, cz] : [cx, cz + u]);
			const [hx, hz] = at(-flip * len * 0.08);
			b.box.add(shape(hx, g + hh / 2 + 0.3, hz, len * 0.78, hh, wide * 0.7, ry, tilt), hull);
			const [nx, nz] = at(nose);
			b.box.add(
				shape(nx, g + hh * 0.45 + 0.3, nz, len * 0.2, hh * 0.7, wide * 0.45, ry, tilt),
				hull
			);
			const [bx, bz] = at(-flip * len * 0.2);
			b.box.add(
				shape(bx, g + hh + 0.6, bz, len * 0.25, 0.7, wide * 0.4, ry, tilt),
				c.set(hull).multiplyScalar(1.2)
			);
			// Landing struts.
			for (const [px, pz] of corners(p.x, p.y, w, d, Math.min(w, d) * 0.25)) {
				b.box.add(shape(px, g + 0.2, pz, 0.15, 0.4, 0.15), 0x1c1d20);
			}
			if (!wreck) {
				b.glowBox.add(
					shape(bx, g + hh + 0.65, bz, len * 0.26, 0.12, wide * 0.42, ry),
					c.set(COLD).multiplyScalar(0.5)
				);
				const [ex, ez] = at(-flip * len * 0.48);
				b.glowCylinder.add(
					shape(ex, g + hh / 2 + 0.3, ez, 0.5, 0.2, 0.5, ry, Math.PI / 2),
					c.set(0x6a3020)
				);
			}
			top = g + hh + 1.3;
			break;
		}
		case 'crane': {
			const [tx, tz] = along ? [p.x + 0.5, cz] : [cx, p.y + 0.5];
			const colour = 0x4a3f22;
			b.box.add(shape(tx, g + h / 2, tz, 0.5, h, 0.5), colour);
			const len = along ? w : d;
			b.box.add(
				shape(
					along ? p.x + len / 2 : tx,
					g + h,
					along ? tz : p.y + len / 2,
					along ? len : 0.4,
					0.35,
					along ? 0.4 : len
				),
				colour
			);
			b.box.add(shape(tx, g + h - 0.6, tz, 0.9, 0.6, 0.9), 0x2a2622);
			b.glowBox.add(shape(tx, g + h + 0.3, tz, 0.15, 0.15, 0.15), 0xd0302a);
			break;
		}
		case 'sign': {
			const sh = Math.max(1.2, h);
			b.box.add(shape(p.x + 0.2, g + sh / 2, cz, 0.08, sh, 0.08), 0x2a2622);
			b.box.add(shape(p.x + w - 0.2, g + sh / 2, cz, 0.08, sh, 0.08), 0x2a2622);
			b.box.add(shape(cx, g + sh - 0.3, cz, w - 0.1, 0.6, 0.06), 0x40382c);
			top = g + sh;
			break;
		}
		default:
			top = g + furniture(b, p.kind, p.x + 0.5, g, p.y + 0.5, n);
	}

	if (p.label) labels.push({ text: p.label, kind: p.kind, x: cx, y: top + 0.3, z: cz });
	return lamp;
}

/** Lit windows on all four faces, floor by floor, a share of them lit. */
function windows(
	b: PropBatches,
	x: number,
	y: number,
	w: number,
	d: number,
	g: number,
	h: number,
	lit: number,
	colour: number
): void {
	const glow = c.set(colour).multiplyScalar(0.75);
	for (let level = 0.9; level < h - 0.4; level += 1.1) {
		for (let i = 0.5; i < w; i += 1) {
			if (noise(Math.floor(x + i), Math.floor(level * 10), y) < lit)
				b.glowBox.add(shape(x + i, g + level, y + 0.03, 0.4, 0.45, 0.04), glow);
			if (noise(Math.floor(x + i), Math.floor(level * 10), y + 997) < lit)
				b.glowBox.add(shape(x + i, g + level, y + d - 0.03, 0.4, 0.45, 0.04), glow);
		}
		for (let j = 0.5; j < d; j += 1) {
			if (noise(Math.floor(y + j), Math.floor(level * 10), x) < lit)
				b.glowBox.add(shape(x + 0.03, g + level, y + j, 0.04, 0.45, 0.4), glow);
			if (noise(Math.floor(y + j), Math.floor(level * 10), x + 991) < lit)
				b.glowBox.add(shape(x + w - 0.03, g + level, y + j, 0.04, 0.45, 0.4), glow);
		}
	}
}

/** The four corners of a footprint, inset. */
function corners(x: number, y: number, w: number, d: number, inset: number): [number, number][] {
	return [
		[x + inset, y + inset],
		[x + w - inset, y + inset],
		[x + inset, y + d - inset],
		[x + w - inset, y + d - inset]
	];
}

/** A piece of furniture on one tile, centred on x, z; returns its height. */
function furniture(
	b: PropBatches,
	kind: string,
	x: number,
	g: number,
	z: number,
	n: number
): number {
	switch (kind) {
		case 'counter':
			b.box.add(shape(x, g + 0.45, z, 0.98, 0.9, 0.7), 0x3e362e);
			b.box.add(shape(x, g + 0.92, z, 1, 0.05, 0.76), 0x5a5048);
			return 1;
		case 'kiosk':
			b.box.add(shape(x, g + 0.65, z, 0.5, 1.3, 0.4), 0x2c3036);
			b.glowBox.add(shape(x, g + 1.0, z + 0.21, 0.36, 0.4, 0.02), c.set(COLD).multiplyScalar(0.8));
			return 1.3;
		case 'sofa':
			b.box.add(shape(x, g + 0.22, z, 0.95, 0.44, 0.7), 0x3a2a30);
			b.box.add(shape(x, g + 0.5, z - 0.3, 0.95, 0.5, 0.18), 0x34262b);
			return 0.8;
		case 'bin':
			b.cylinder.add(shape(x, g + 0.25, z, 0.4, 0.5, 0.4), 0x2c302c);
			return 0.5;
		case 'shelf':
			b.box.add(shape(x, g + 0.85, z, 0.9, 1.7, 0.45), 0x302c28);
			for (let s = 0.4; s < 1.7; s += 0.42)
				b.box.add(shape(x, g + s, z + 0.02, 0.86, 0.04, 0.45), 0x4a4038);
			return 1.7;
		case 'console':
		case 'desk':
		case 'table': {
			b.box.add(shape(x, g + 0.4, z, 0.9, 0.8, 0.6), kind === 'table' ? 0x3a322a : 0x2c3036);
			if (kind !== 'table')
				b.glowBox.add(
					shape(x, g + 0.95, z - 0.15, 0.6, 0.3, 0.04),
					c.set(kind === 'console' ? HYDRA : COLD).multiplyScalar(0.7)
				);
			return 1.1;
		}
		case 'lockers':
			b.box.add(shape(x, g + 0.85, z, 0.9, 1.7, 0.5), 0x34403a);
			b.box.add(shape(x, g + 0.85, z + 0.26, 0.02, 1.6, 0.02), 0x1c201e);
			return 1.7;
		case 'crate':
			b.box.add(shape(x, g + 0.35, z, 0.75, 0.7, 0.75, n * 0.6), 0x40352a);
			return 0.7;
		case 'holo':
			b.cylinder.add(shape(x, g + 0.1, z, 0.6, 0.2, 0.6), 0x2c3036);
			b.glowCylinder.add(shape(x, g + 0.7, z, 0.3, 1.0, 0.3), c.set(HYDRA).multiplyScalar(0.5));
			return 1.2;
		case 'cloning-pod':
			// A clouded glass chamber on a dark base, lit from inside.
			b.cylinder.add(shape(x, g + 0.12, z, 0.85, 0.24, 0.85), 0x1e2428);
			b.glowCylinder.add(shape(x, g + 1.0, z, 0.66, 1.5, 0.66), c.set(HYDRA).multiplyScalar(0.35));
			b.cylinder.add(shape(x, g + 1.85, z, 0.8, 0.2, 0.8), 0x1e2428);
			return 2;
		case 'hydra-console':
			b.box.add(shape(x, g + 0.5, z, 0.6, 1.0, 0.8), 0x23292c);
			b.box.add(shape(x + 0.25, g + 1.3, z, 0.1, 1.6, 0.9), 0x1a1f22);
			b.glowBox.add(shape(x + 0.19, g + 1.35, z, 0.02, 0.8, 0.7), HYDRA);
			return 2.1;
		default:
			// A kind this client does not know: plainly visible, not hidden.
			b.box.add(shape(x, g + 0.4, z, 0.6, 0.8, 0.6), 0xff00ff);
			return 0.8;
	}
}
