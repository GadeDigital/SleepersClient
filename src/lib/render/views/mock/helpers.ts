import {
	AdditiveBlending,
	BoxGeometry,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Line,
	LineDashedMaterial,
	Matrix4,
	MeshLambertMaterial,
	Points,
	PointsMaterial,
	Quaternion,
	Sprite,
	SpriteMaterial,
	Vector3,
	type ColorRepresentation,
	type InstancedMesh,
	type MeshLambertMaterialParameters,
	type Object3D,
	type PointsMaterialParameters,
	type Texture
} from 'three';
import {
	dotTexture,
	glowTexture,
	heatTexture,
	panelTexture,
	ringTexture,
	zTexture
} from '../../textures';
import type { Rand } from './rng';

/**
 * Light intensities are multiplied by this to match the reference mockup:
 * three.js r128, which it was made with, scaled lights by π internally
 * (the legacy lighting mode removed in r165).
 */
export const LIGHT = Math.PI;

/** The canvas textures the mock views share; made once per mockup. */
export interface MockTextures {
	glow: Texture;
	heat: Texture;
	dot: Texture;
	ring: Texture;
	z: Texture;
	panel: Texture;
}

export function makeMockTextures(): MockTextures {
	return {
		glow: glowTexture(),
		heat: heatTexture(),
		dot: dotTexture(),
		ring: ringTexture(),
		z: zTexture(),
		panel: panelTexture()
	};
}

export function disposeMockTextures(t: MockTextures): void {
	for (const texture of Object.values(t)) texture.dispose();
}

export const UP = new Vector3(0, 1, 0);

/** A unit box, scaled per use. */
export const box = new BoxGeometry(1, 1, 1);

export function lam(color: ColorRepresentation, extra: MeshLambertMaterialParameters = {}) {
	return new MeshLambertMaterial({ color, ...extra });
}

export function placed<T extends Object3D>(o: T, p: Vector3): T {
	o.position.copy(p);
	return o;
}

export function glowSprite(
	tex: MockTextures,
	color: ColorRepresentation,
	size: number,
	opacity = 1
): Sprite {
	const s = new Sprite(
		new SpriteMaterial({
			map: tex.glow,
			color,
			transparent: true,
			opacity,
			blending: AdditiveBlending,
			depthWrite: false
		})
	);
	s.scale.set(size, size, 1);
	return s;
}

export function ringSprite(tex: MockTextures, color: ColorRepresentation, size: number): Sprite {
	const s = new Sprite(
		new SpriteMaterial({
			map: tex.ring,
			color,
			transparent: true,
			depthWrite: false,
			blending: AdditiveBlending
		})
	);
	s.scale.set(size, size, 1);
	return s;
}

/** One Points object with round dots, sized in CSS pixels whatever the distance. */
export function pointsFrom(
	tex: MockTextures,
	positions: number[],
	colors: number[] | null,
	size: number,
	opts: PointsMaterialParameters = {}
): Points {
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(positions, 3));
	if (colors) g.setAttribute('color', new Float32BufferAttribute(colors, 3));
	const m = new PointsMaterial({
		size,
		sizeAttenuation: false,
		map: tex.dot,
		transparent: true,
		depthWrite: false,
		vertexColors: !!colors,
		alphaTest: 0.1,
		...opts
	});
	return new Points(g, m);
}

/** A shell of faint background stars between two radii. */
export function starShell(
	tex: MockTextures,
	rand: Rand,
	n: number,
	rMin: number,
	rMax: number,
	size: number
): Points {
	const p: number[] = [];
	const c: number[] = [];
	const col = new Color();
	for (let i = 0; i < n; i++) {
		const u = rand() * 2 - 1;
		const th = rand() * Math.PI * 2;
		const r = rMin + rand() * (rMax - rMin);
		const s = Math.sqrt(1 - u * u);
		p.push(r * s * Math.cos(th), r * u, r * s * Math.sin(th));
		const k = rand();
		col
			.set(k < 0.15 ? 0xffd2a0 : k < 0.3 ? 0xa9c4ff : 0xe8ecf5)
			.multiplyScalar(0.45 + rand() * 0.55);
		c.push(col.r, col.g, col.b);
	}
	return pointsFrom(tex, p, c, size);
}

export function dashed(
	a: Vector3,
	b: Vector3,
	color: ColorRepresentation,
	dash: number,
	gap: number,
	opacity = 1
): Line {
	const g = new BufferGeometry().setFromPoints([a, b]);
	const l = new Line(
		g,
		new LineDashedMaterial({ color, dashSize: dash, gapSize: gap, transparent: true, opacity })
	);
	l.computeLineDistances();
	return l;
}

const m4 = new Matrix4();
const q = new Quaternion();
const s = new Vector3();
const p = new Vector3();

/** Sets one instance's position, scale and turn about the vertical. */
export function setInst(
	mesh: InstancedMesh,
	i: number,
	x: number,
	y: number,
	z: number,
	sx: number,
	sy: number,
	sz: number,
	rotY = 0
): void {
	q.setFromAxisAngle(UP, rotY);
	mesh.setMatrixAt(i, m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz)));
}
