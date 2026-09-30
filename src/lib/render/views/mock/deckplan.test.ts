import { describe, expect, it } from 'vitest';
import {
	bfs,
	EDGES,
	FLOOR_TILES,
	isDoor,
	isWalk,
	NAV_SPOT,
	REGIONS,
	roomAt,
	START,
	wallBetween
} from './deckplan';

describe('the deck plan', () => {
	it('has every region laid out without overlaps', () => {
		const area = REGIONS.reduce((sum, r) => sum + r.w * r.h, 0);
		expect(FLOOR_TILES.length).toBe(area);
	});

	it('walls the outside of the ship', () => {
		expect(wallBetween(2, 1, 2, 0)).toBe(true); // quarters' north face
		expect(wallBetween(28, 8, 29, 8)).toBe(true); // bridge's east face
	});

	it('leaves corridors open to each other', () => {
		expect(wallBetween(4, 7, 4, 8)).toBe(false); // side corridor into the main one
		expect(isDoor(4, 7, 4, 8)).toBe(false);
	});

	it('puts a doorway wherever a corridor meets a room', () => {
		const doors = EDGES.doors.map(
			([x, z, dx, dz]) => `${roomAt(x, z)} | ${roomAt(x + dx, z + dz)}`
		);
		expect(doors.sort()).toEqual(
			[
				'Corridor to cargo | Cargo hold',
				'Corridor to engine room | Engine room',
				'Crew quarters | Corridor to quarters',
				'Main corridor | Bridge',
				'Main corridor | Bridge',
				'Mess | Corridor to mess'
			].sort()
		);
	});

	it('walls every edge between two different rooms, and none inside a room', () => {
		// No two rooms touch in the demo ship, so check the rule over every
		// pair of neighbouring floor tiles.
		for (const [x, z] of FLOOR_TILES) {
			for (const [nx, nz] of [
				[x + 1, z],
				[x, z + 1]
			]) {
				const a = REGIONS.findIndex((r) => roomAt(x, z) === r.name);
				const b = REGIONS.findIndex((r) => roomAt(nx, nz) === r.name);
				if (a < 0 || b < 0) continue;
				const bothRooms = REGIONS[a].kind === 'room' && REGIONS[b].kind === 'room';
				expect(wallBetween(x, z, nx, nz)).toBe(a !== b && bothRooms);
			}
		}
	});

	it('lists each shared edge once', () => {
		const keys = [...EDGES.walls, ...EDGES.doors].map((e) => e.join(','));
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe('walking', () => {
	it('blocks props but not bridge seats or sleepers', () => {
		expect(isWalk(28, 8)).toBe(false); // nav console
		expect(isWalk(26, 7)).toBe(true); // bridge seat
		expect(isWalk(3, 1)).toBe(false); // a cryo pod (with a sleeper in it)
	});

	it('finds a way from the start to the nav station through the doorways', () => {
		const path = bfs(START[0], START[1], NAV_SPOT[0], NAV_SPOT[1]);
		expect(path).not.toBeNull();
		expect(path?.at(-1)).toEqual(NAV_SPOT);
		let [x, z] = START;
		for (const [nx, nz] of path ?? []) {
			expect(Math.abs(nx - x) + Math.abs(nz - z)).toBe(1);
			expect(wallBetween(x, z, nx, nz)).toBe(false);
			expect(isWalk(nx, nz)).toBe(true);
			[x, z] = [nx, nz];
		}
	});

	it('refuses a blocked or outside target', () => {
		expect(bfs(START[0], START[1], 28, 8)).toBeNull();
		expect(bfs(START[0], START[1], 0, 0)).toBeNull();
	});
});
