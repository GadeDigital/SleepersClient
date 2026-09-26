import { describe, expect, it } from 'vitest';
import { zoomFor } from './world-renderer';

describe('zoomFor', () => {
	it('gives a whole number of physical pixels per art pixel near 3 CSS pixels', () => {
		expect(zoomFor(1)).toBe(3);
		expect(zoomFor(1.25)).toBe(4);
		expect(zoomFor(1.5)).toBe(5);
		expect(zoomFor(2)).toBe(6);
		expect(zoomFor(0.25)).toBe(1);
	});
});
