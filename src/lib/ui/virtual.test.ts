import { describe, expect, it } from 'vitest';
import { layout, visibleRange } from './virtual';

describe('virtual list layout', () => {
	it('stacks measured rows and estimates the rest', () => {
		const heights = [10, undefined, 30];
		expect(layout(3, (i) => heights[i], 20)).toEqual({ tops: [0, 10, 30], total: 60 });
	});

	it('finds the rows overlapping the viewport, with overscan', () => {
		// 100 rows of 20 px; viewport 100 px scrolled to 500 shows rows 25 to 29.
		const l = layout(100, () => 20, 20);
		expect(visibleRange(l, 500, 100, 0)).toEqual([25, 30]);
		expect(visibleRange(l, 510, 100, 0)).toEqual([25, 31]);
		expect(visibleRange(l, 500, 100, 3)).toEqual([22, 33]);
		expect(visibleRange(l, 1990, 100, 3)).toEqual([96, 100]);
	});

	it('handles an empty list', () => {
		expect(
			visibleRange(
				layout(0, () => 1, 1),
				0,
				100,
				3
			)
		).toEqual([0, 0]);
	});
});
