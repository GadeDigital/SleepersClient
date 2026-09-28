import { describe, expect, it } from 'vitest';
import { childInBox, childIndex, cubeAddress, cubeIndex, formatCube } from './cubes';

/** The mockup's player, just above the galactic plane (brief section 6.8). */
const YOU = { x: 24163, y: -6143, z: 24 };

describe('cubeIndex', () => {
	it('floors, so negative positions fall in the cube below', () => {
		expect(cubeIndex(YOU, 10)).toEqual([2416, -615, 2]);
		expect(cubeIndex({ x: -1, y: -10, z: -11 }, 10)).toEqual([-1, -1, -2]);
		expect(cubeIndex({ x: 0, y: 9, z: 10 }, 10)).toEqual([0, 0, 1]);
	});
});

describe('childIndex', () => {
	it('is always 0 to 9, negatives included', () => {
		expect(childIndex([2416, -615, 2])).toEqual([6, 5, 2]);
		expect(childIndex([-1, -10, -11])).toEqual([9, 0, 9]);
	});
});

describe('the mockup layout', () => {
	it('puts your cube where the reference does, in scene order [x, height, y]', () => {
		expect(childInBox(YOU, 10)).toEqual([6, 2, 5]); // zoom 3
		expect(childInBox(YOU, 100)).toEqual([1, 0, 8]); // zoom 4
		expect(childInBox(YOU, 1000)).toEqual([4, 0, 3]); // zoom 5
	});

	it('gives the address lines of the brief', () => {
		expect(cubeAddress(YOU, 3)).toBe('10 ly cube (2416, −615, 2) · in a 100 ly neighbourhood');
		expect(cubeAddress(YOU, 4)).toBe('100 ly cube (241, −62, 0) · in a 1,000 ly cell');
		expect(cubeAddress(YOU, 5)).toBe('1,000 ly cube (24, −7, 0) · in a 10,000 ly region');
		expect(cubeAddress(YOU, 6)).toBe(
			'10,000 ly cube (2, −1, 0) · galaxy 100,000 × 100,000 × 20,000 ly'
		);
	});
});

describe('formatCube', () => {
	it('uses a true minus sign', () => {
		expect(formatCube([-3, 0, 12])).toBe('(−3, 0, 12)');
	});
});
