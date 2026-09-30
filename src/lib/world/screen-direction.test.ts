import { describe, expect, it } from 'vitest';
import { Direction } from '$lib/proto/sleepers/v1/world_pb';
import { screenToGrid } from './screen-direction';

const { NORTH, NORTH_EAST, EAST, SOUTH_EAST, SOUTH, SOUTH_WEST, WEST, NORTH_WEST } = Direction;

/** The four game headings: π/4, then Q/E steps of 90° (ADR 057). */
const HEADINGS = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);

/** Screen keys as [right, up]. */
const UP: [number, number] = [0, 1];
const RIGHT: [number, number] = [1, 0];
const DOWN: [number, number] = [0, -1];
const LEFT: [number, number] = [-1, 0];
const UP_RIGHT: [number, number] = [1, 1];

describe('screenToGrid', () => {
	it('maps every key at each of the four headings', () => {
		// [up, right, down, left, up+right] per heading, turning a quarter each time.
		const expected = [
			[NORTH_WEST, NORTH_EAST, SOUTH_EAST, SOUTH_WEST, NORTH],
			[SOUTH_WEST, NORTH_WEST, NORTH_EAST, SOUTH_EAST, WEST],
			[SOUTH_EAST, SOUTH_WEST, NORTH_WEST, NORTH_EAST, SOUTH],
			[NORTH_EAST, SOUTH_EAST, SOUTH_WEST, NORTH_WEST, EAST]
		];
		HEADINGS.forEach((h, i) => {
			const got = [UP, RIGHT, DOWN, LEFT, UP_RIGHT].map(([r, u]) => screenToGrid(r, u, h));
			expect(got, `heading ${i}`).toEqual(expected[i]);
		});
	});

	it('gives every grid direction from some key or pair at every heading', () => {
		const pairs: [number, number][] = [];
		for (const r of [-1, 0, 1]) for (const u of [-1, 0, 1]) if (r || u) pairs.push([r, u]);
		for (const h of HEADINGS) {
			const dirs = new Set(pairs.map(([r, u]) => screenToGrid(r, u, h)));
			expect(dirs.size).toBe(8);
		}
	});

	it('keeps W north and D east at heading 0, as before the camera turned', () => {
		expect(screenToGrid(0, 1, 0)).toBe(NORTH);
		expect(screenToGrid(1, 0, 0)).toBe(EAST);
		expect(screenToGrid(-1, -1, 0)).toBe(SOUTH_WEST);
	});

	it('gives nothing when opposite keys cancel', () => {
		expect(screenToGrid(0, 0, HEADINGS[0])).toBeNull();
	});
});
