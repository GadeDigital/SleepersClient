import { describe, expect, it } from 'vitest';
import { nearest, wrapDelta } from './wrap';

describe('wrapping', () => {
	it('takes the short way round', () => {
		expect(wrapDelta(1, 100)).toBe(1);
		expect(wrapDelta(-99, 100)).toBe(1); // from 99 east to 0
		expect(wrapDelta(99, 100)).toBe(-1); // from 0 west to 99
		expect(wrapDelta(0, 100)).toBe(0);
	});

	it('finds the copy nearest the camera', () => {
		expect(nearest(4095, 1, 4096)).toBe(-1); // just west of the seam
		expect(nearest(0, 4095, 4096)).toBe(4096); // just east of it
		expect(nearest(2000, 2010, 4096)).toBe(2000);
	});
});
