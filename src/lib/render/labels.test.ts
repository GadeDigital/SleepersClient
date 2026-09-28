import { describe, expect, it } from 'vitest';
import { screenPoint } from './labels';

describe('screenPoint', () => {
	it('maps normalised coordinates to CSS pixels, y down', () => {
		expect(screenPoint({ x: 0, y: 0, z: 0 }, 800, 600)).toEqual([400, 300]);
		expect(screenPoint({ x: -1, y: 1, z: 0.5 }, 800, 600)).toEqual([0, 0]);
		expect(screenPoint({ x: 1, y: -1, z: 0.5 }, 800, 600)).toEqual([800, 600]);
	});

	it('hides points behind the camera or well outside the view', () => {
		expect(screenPoint({ x: 0, y: 0, z: 1.01 }, 800, 600)).toBeNull();
		expect(screenPoint({ x: 0, y: 0, z: -1.01 }, 800, 600)).toBeNull();
		expect(screenPoint({ x: 1.11, y: 0, z: 0 }, 800, 600)).toBeNull();
		expect(screenPoint({ x: 0, y: -1.11, z: 0 }, 800, 600)).toBeNull();
		// Just outside the edge still shows, so labels slide off rather than pop.
		expect(screenPoint({ x: 1.05, y: 0, z: 0 }, 800, 600)).not.toBeNull();
	});
});
