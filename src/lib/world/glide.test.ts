import { describe, expect, it } from 'vitest';
import type { CharacterView } from '$lib/net/game-state.svelte';
import { CharacterState } from '$lib/proto/glyph/v1/world_pb';
import { glidePosition } from './glide';

const standing: CharacterView = {
	id: 1,
	name: 'Ana',
	x: 1,
	y: 1,
	state: CharacterState.AWAKE,
	step: null
};
const stepping: CharacterView = {
	...standing,
	step: { fromX: 1, fromY: 1, toX: 2, toY: 2, startTick: 10, arriveTick: 15 }
};

describe('glidePosition', () => {
	it('draws a standing character on its tile', () => {
		expect(glidePosition(standing, 99)).toEqual([1, 1]);
	});

	it('glides over the step ticks', () => {
		expect(glidePosition(stepping, 10)).toEqual([1, 1]);
		expect(glidePosition(stepping, 12.5)).toEqual([1.5, 1.5]);
		expect(glidePosition(stepping, 15)).toEqual([2, 2]);
	});

	it('waits at the ends when the tick estimate is off', () => {
		expect(glidePosition(stepping, 8)).toEqual([1, 1]);
		expect(glidePosition(stepping, 17)).toEqual([2, 2]);
	});

	it('glides the short way across the seam', () => {
		const seam: CharacterView = {
			...standing,
			step: { fromX: 63, fromY: 1, toX: 0, toY: 1, startTick: 10, arriveTick: 15 }
		};
		expect(glidePosition(seam, 12.5, 64)).toEqual([63.5, 1]);
		expect(glidePosition(seam, 15, 64)).toEqual([64, 1]);
	});
});
