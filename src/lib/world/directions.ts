import { Direction } from '$lib/proto/glyph/v1/world_pb';

/** One-tile offset for each direction; y grows south (see world.proto). */
export const DELTAS: Record<Direction, [number, number]> = {
	[Direction.UNSPECIFIED]: [0, 0],
	[Direction.NORTH]: [0, -1],
	[Direction.NORTH_EAST]: [1, -1],
	[Direction.EAST]: [1, 0],
	[Direction.SOUTH_EAST]: [1, 1],
	[Direction.SOUTH]: [0, 1],
	[Direction.SOUTH_WEST]: [-1, 1],
	[Direction.WEST]: [-1, 0],
	[Direction.NORTH_WEST]: [-1, -1]
};

/** The direction for an offset, or null for (0, 0). */
export function directionOf(dx: number, dy: number): Direction | null {
	const sx = Math.sign(dx);
	const sy = Math.sign(dy);
	for (const [dir, [x, y]] of Object.entries(DELTAS)) {
		if (x === sx && y === sy && Number(dir) !== Direction.UNSPECIFIED) return Number(dir);
	}
	return null;
}
