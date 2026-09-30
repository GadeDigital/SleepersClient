/**
 * Nested cubes over the galaxy (ADR 054, proposed). The galaxy is centred on
 * the origin: x and y run from −50,000 to +50,000 ly and z (height) from
 * −10,000 to +10,000 ly, in whole light-years. It is divided into cubes of
 * 10,000, 1,000, 100, 10 and 1 ly.
 */

/** A galaxy position in light-years; z is height above the galactic plane. */
export interface GalaxyPosition {
	x: number;
	y: number;
	z: number;
}

/** A cube's index along x, y and z. */
export type CubeIndex = [number, number, number];

/** The cube a position is in at one size: floor(position / size), negatives too. */
export function cubeIndex(p: GalaxyPosition, size: number): CubeIndex {
	return [Math.floor(p.x / size), Math.floor(p.y / size), Math.floor(p.z / size)];
}

/** Where a cube sits inside its parent (the size ten times larger): 0 to 9 per axis. */
export function childIndex(index: CubeIndex): CubeIndex {
	const m = (i: number) => ((i % 10) + 10) % 10;
	return [m(index[0]), m(index[1]), m(index[2])];
}

/**
 * The cube you are in at one size, placed inside the box one size up, in
 * scene order [x, height, y] (scene Y is up).
 */
export function childInBox(p: GalaxyPosition, size: number): CubeIndex {
	const [x, y, z] = childIndex(cubeIndex(p, size));
	return [x, z, y];
}

/** "1,000" style thousands separators. */
function thousands(n: number): string {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** A cube index as "(2416, −615, 2)", with a true minus sign. */
export function formatCube(index: CubeIndex): string {
	const n = (i: number) => (i < 0 ? `−${-i}` : String(i));
	return `(${index.map(n).join(', ')})`;
}

/**
 * The address line for zooms 3 to 6: the cube you are in at that zoom's
 * cube size, and the box it sits in.
 */
export function cubeAddress(p: GalaxyPosition, zoom: 3 | 4 | 5 | 6): string {
	if (zoom === 6) {
		return `10,000 ly cube ${formatCube(cubeIndex(p, 10_000))} · galaxy 100,000 × 100,000 × 20,000 ly`;
	}
	const size = { 3: 10, 4: 100, 5: 1000 }[zoom];
	const box = { 3: 'neighbourhood', 4: 'cell', 5: 'region' }[zoom];
	return `${thousands(size)} ly cube ${formatCube(cubeIndex(p, size))} · in a ${thousands(size * 10)} ly ${box}`;
}
