import { Vector3 } from 'three';

/**
 * The mockup's demo ship (ADR 055): rooms joined by corridors, walls on
 * tile edges, doorways where a corridor meets a room. One plan drives both
 * the interior (zoom 1) and the exterior hull (zoom 2). Mock data only:
 * the walking and nav rules here are the mockup's, never the game's.
 */

export const W = 30;
export const H = 19;

export interface Region {
	name: string;
	kind: 'room' | 'hall';
	x: number;
	z: number;
	w: number;
	h: number;
	floor: number;
	hull: number;
	height: number;
	/** The face with lit windows, for rooms on the hull. */
	win?: 'n' | 's' | 'e';
}

export const REGIONS: readonly Region[] = [
	{
		name: 'Crew quarters',
		kind: 'room',
		x: 2,
		z: 1,
		w: 6,
		h: 5,
		floor: 0x443f52,
		hull: 0x9aa3b5,
		height: 2.0,
		win: 'n'
	},
	{
		name: 'Mess',
		kind: 'room',
		x: 12,
		z: 1,
		w: 6,
		h: 5,
		floor: 0x4a4437,
		hull: 0xa59d8d,
		height: 1.8,
		win: 'n'
	},
	{
		name: 'Engine room',
		kind: 'room',
		x: 1,
		z: 12,
		w: 7,
		h: 6,
		floor: 0x4c3b33,
		hull: 0x777e90,
		height: 2.4,
		win: 's'
	},
	{
		name: 'Cargo hold',
		kind: 'room',
		x: 12,
		z: 12,
		w: 7,
		h: 6,
		floor: 0x45493a,
		hull: 0x8e9585,
		height: 2.7,
		win: 's'
	},
	{
		name: 'Bridge',
		kind: 'room',
		x: 23,
		z: 5,
		w: 6,
		h: 8,
		floor: 0x2e4a55,
		hull: 0xb2bbca,
		height: 1.8,
		win: 'e'
	},
	{
		name: 'Main corridor',
		kind: 'hall',
		x: 3,
		z: 8,
		w: 20,
		h: 2,
		floor: 0x394155,
		hull: 0x7f8799,
		height: 1.1
	},
	{
		name: 'Corridor to quarters',
		kind: 'hall',
		x: 4,
		z: 6,
		w: 1,
		h: 2,
		floor: 0x394155,
		hull: 0x7f8799,
		height: 0.95
	},
	{
		name: 'Corridor to mess',
		kind: 'hall',
		x: 14,
		z: 6,
		w: 1,
		h: 2,
		floor: 0x394155,
		hull: 0x7f8799,
		height: 0.95
	},
	{
		name: 'Corridor to engine room',
		kind: 'hall',
		x: 4,
		z: 10,
		w: 1,
		h: 2,
		floor: 0x394155,
		hull: 0x7f8799,
		height: 0.95
	},
	{
		name: 'Corridor to cargo',
		kind: 'hall',
		x: 15,
		z: 10,
		w: 1,
		h: 2,
		floor: 0x394155,
		hull: 0x7f8799,
		height: 0.95
	}
];

export const REGION_INDEX = {
	engine: 2,
	bridge: 4
} as const;

type Tile = [number, number];

export const PROPS: Readonly<Record<string, readonly Tile[]>> = {
	pods: [
		[3, 1],
		[5, 1],
		[7, 1]
	],
	sleepers: [
		[3, 1],
		[7, 1]
	],
	lockers: [
		[2, 5],
		[7, 5]
	],
	tables: [
		[13, 3],
		[16, 3]
	],
	counter: [
		[15, 1],
		[16, 1],
		[17, 1]
	],
	crates: [
		[13, 13],
		[14, 13],
		[17, 13],
		[13, 16],
		[17, 16],
		[18, 16],
		[16, 15]
	],
	reactor: [
		[3, 14],
		[4, 14],
		[3, 15],
		[4, 15]
	],
	engcon: [[7, 13]],
	navcon: [
		[28, 8],
		[28, 9]
	],
	sidecon: [
		[24, 5],
		[24, 12]
	],
	seats: [
		[26, 7],
		[26, 10]
	]
};

export const NAV_TILES: readonly Tile[] = [
	[27, 8],
	[27, 9]
];
export const NAV_SPOT: Tile = [27, 8];
export const START: Tile = [10, 8];

/** The four ways to step: walking in the mockup is 4-way. */
export const DIRS: readonly Tile[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];

const RID: number[][] = [];
for (let z = 0; z < H; z++) RID.push(new Array<number>(W).fill(-1));
REGIONS.forEach((r, i) => {
	for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) RID[z][x] = i;
});

/** The region a tile belongs to, or -1 outside the ship. */
export function rid(x: number, z: number): number {
	return x < 0 || z < 0 || x >= W || z >= H ? -1 : RID[z][x];
}

export function isFloor(x: number, z: number): boolean {
	return rid(x, z) >= 0;
}

const BLOCKED = new Set<string>();
for (const [k, tiles] of Object.entries(PROPS)) {
	if (k !== 'seats' && k !== 'sleepers') for (const [x, z] of tiles) BLOCKED.add(`${x},${z}`);
}

export function isWalk(x: number, z: number): boolean {
	return isFloor(x, z) && !BLOCKED.has(`${x},${z}`);
}

/**
 * Whether a wall stands on the edge between two neighbouring tiles: at the
 * ship's outside, and between two different rooms.
 */
export function wallBetween(ax: number, az: number, bx: number, bz: number): boolean {
	const a = rid(ax, az);
	const b = rid(bx, bz);
	if (a < 0 || b < 0) return true;
	if (a === b) return false;
	return REGIONS[a].kind === 'room' && REGIONS[b].kind === 'room';
}

/** Whether the edge is a doorway: a corridor meeting a room. */
export function isDoor(ax: number, az: number, bx: number, bz: number): boolean {
	const a = rid(ax, az);
	const b = rid(bx, bz);
	return a >= 0 && b >= 0 && a !== b && REGIONS[a].kind !== REGIONS[b].kind;
}

export function roomAt(x: number, z: number): string {
	const i = rid(x, z);
	return i < 0 ? 'Outside' : REGIONS[i].name;
}

/** A tile's centre in the deck scene; the plan is centred on the origin. */
export function tileToWorld(x: number, z: number, out = new Vector3()): Vector3 {
	return out.set(x - W / 2 + 0.5, 0, z - H / 2 + 0.5);
}

export function worldToTile(v: { x: number; z: number }): Tile {
	return [Math.floor(v.x + W / 2), Math.floor(v.z + H / 2)];
}

export const FLOOR_TILES: readonly Tile[] = (() => {
	const out: Tile[] = [];
	for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (isFloor(x, z)) out.push([x, z]);
	return out;
})();

/** An edge of a floor tile: the tile and the step across the edge. */
export type Edge = [x: number, z: number, dx: number, dz: number];

/**
 * Every wall and doorway edge, each listed once, in the reference's order:
 * walls at the ship's outside from every floor tile, and edges between two
 * floor tiles only from the tile on their west or north side.
 */
export const EDGES: { walls: readonly Edge[]; doors: readonly Edge[] } = (() => {
	const walls: Edge[] = [];
	const doors: Edge[] = [];
	for (const [x, z] of FLOOR_TILES) {
		for (const [dx, dz] of DIRS) {
			const nx = x + dx;
			const nz = z + dz;
			if (!isFloor(nx, nz)) walls.push([x, z, dx, dz]);
			else if (dx + dz > 0) {
				if (wallBetween(x, z, nx, nz)) walls.push([x, z, dx, dz]);
				else if (isDoor(x, z, nx, nz)) doors.push([x, z, dx, dz]);
			}
		}
	}
	return { walls, doors };
})();

/**
 * A 4-way path from one tile to another, not counting the start, that never
 * crosses a wall; null if there is none. Breadth-first, as in the reference.
 */
export function bfs(sx: number, sz: number, tx: number, tz: number): Tile[] | null {
	if (!isWalk(tx, tz)) return null;
	const key = (x: number, z: number) => z * W + x;
	const prev = new Map<number, number>([[key(sx, sz), -1]]);
	const queue: Tile[] = [[sx, sz]];
	for (let head = 0; head < queue.length; head++) {
		const [x, z] = queue[head];
		if (x === tx && z === tz) break;
		for (const [dx, dz] of DIRS) {
			const nx = x + dx;
			const nz = z + dz;
			const k = key(nx, nz);
			if (!prev.has(k) && isWalk(nx, nz) && !wallBetween(x, z, nx, nz)) {
				prev.set(k, key(x, z));
				queue.push([nx, nz]);
			}
		}
	}
	if (!prev.has(key(tx, tz))) return null;
	const path: Tile[] = [];
	let k = key(tx, tz);
	while (k !== key(sx, sz) && k !== -1) {
		path.unshift([k % W, Math.floor(k / W)]);
		k = prev.get(k) ?? -1;
	}
	return path;
}
