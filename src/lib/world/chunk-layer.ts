import { Graphics } from 'pixi.js';
import type { Chunk } from '$lib/net/game-state.svelte';
import type { TileType } from '$lib/proto/sleepers/v1/world_pb';
import { TILE_SIZE } from './scale';

/** Drawn for a tile id missing from the catalogue, so it stands out. */
const UNKNOWN = 0xff00ff;
/** A faint grid over the ground, so single tiles can be told apart. */
const GRID = 0x000000;
const GRID_ALPHA = 0.12;

/** A horizontal run of one tile type, in tiles within the chunk. */
export interface Run {
	x: number;
	y: number;
	length: number;
	id: number;
}

/**
 * Splits a chunk's rows into runs of the same tile, so plain ground is drawn
 * with a few rectangles instead of one per tile.
 */
export function runs(tiles: ArrayLike<number>, size: number): Run[] {
	const out: Run[] = [];
	for (let y = 0; y < size; y++) {
		let start = 0;
		for (let x = 1; x <= size; x++) {
			const id = tiles[y * size + start];
			if (x === size || tiles[y * size + x] !== id) {
				out.push({ x: start, y, length: x - start, id });
				start = x;
			}
		}
	}
	return out;
}

/**
 * Draws a chunk in art pixels with its top-left corner at (0, 0), coloured
 * from the tile catalogue (ADR 035).
 */
export function drawChunk(
	chunk: Chunk,
	size: number,
	types: ReadonlyMap<number, TileType>
): Graphics {
	const g = new Graphics();
	for (const run of runs(chunk.tiles, size)) {
		g.rect(run.x * TILE_SIZE, run.y * TILE_SIZE, run.length * TILE_SIZE, TILE_SIZE).fill(
			types.get(run.id)?.colour ?? UNKNOWN
		);
	}
	const span = size * TILE_SIZE;
	for (let i = 0; i < size; i++) {
		g.rect(i * TILE_SIZE, 0, 1, span).fill({ color: GRID, alpha: GRID_ALPHA });
		g.rect(0, i * TILE_SIZE, span, 1).fill({ color: GRID, alpha: GRID_ALPHA });
	}
	return g;
}
