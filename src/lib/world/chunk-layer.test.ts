import { describe, expect, it } from 'vitest';
import { runs } from './chunk-layer';

describe('runs', () => {
	it('merges each row into runs of one tile', () => {
		// A 3 by 3 chunk.
		expect(runs([4, 4, 4, 4, 5, 5, 6, 4, 4], 3)).toEqual([
			{ x: 0, y: 0, length: 3, id: 4 },
			{ x: 0, y: 1, length: 1, id: 4 },
			{ x: 1, y: 1, length: 2, id: 5 },
			{ x: 0, y: 2, length: 1, id: 6 },
			{ x: 1, y: 2, length: 2, id: 4 }
		]);
	});
});
