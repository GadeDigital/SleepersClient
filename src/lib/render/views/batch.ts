import {
	Color,
	Euler,
	InstancedBufferAttribute,
	InstancedMesh,
	Matrix4,
	Quaternion,
	Vector3,
	type BufferGeometry,
	type Material
} from 'three';

/**
 * Collects instances of one geometry and material, then makes one
 * InstancedMesh of exactly that many (ADR 057): a chunk or a map's props
 * are a handful of draw calls, however many tiles they hold.
 */
export class Batch {
	readonly #matrices: number[] = [];
	readonly #colours: number[] = [];
	readonly #colour = new Color();

	get count(): number {
		return this.#matrices.length / 16;
	}

	add(m: Matrix4, colour: Color | number): void {
		m.toArray(this.#matrices, this.#matrices.length);
		const c = typeof colour === 'number' ? this.#colour.set(colour) : colour;
		c.toArray(this.#colours, this.#colours.length);
	}

	/** The mesh, or null when nothing was added. */
	build(geometry: BufferGeometry, material: Material): InstancedMesh | null {
		const n = this.count;
		if (n === 0) return null;
		const mesh = new InstancedMesh(geometry, material, n);
		mesh.instanceMatrix.array.set(this.#matrices);
		mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.#colours), 3);
		mesh.computeBoundingSphere();
		return mesh;
	}
}

const m4 = new Matrix4();
const pos = new Vector3();
const scale = new Vector3();
const quat = new Quaternion();
const euler = new Euler(0, 0, 0, 'YXZ');

/**
 * An instance matrix: a unit shape scaled, turned ry about the vertical and
 * tilted rz, then moved to x, y, z. Shared and overwritten on every call.
 */
export function shape(
	x: number,
	y: number,
	z: number,
	sx: number,
	sy: number,
	sz: number,
	ry = 0,
	rz = 0
): Matrix4 {
	if (ry === 0 && rz === 0) return m4.makeScale(sx, sy, sz).setPosition(x, y, z);
	return m4.compose(
		pos.set(x, y, z),
		quat.setFromEuler(euler.set(0, ry, rz)),
		scale.set(sx, sy, sz)
	);
}

/** A deterministic 0–1 value per tile and salt, for variation that never changes. */
export function noise(x: number, y: number, salt = 0): number {
	let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
