import { describe, expect, it } from 'vitest';
import { canvasLayout, DEFAULT_PIXEL_SIZE, loadPixelSize } from './pixel';

describe('the pixel size setting', () => {
	it('is Off, smooth, until a player picks another (ADR 069)', () => {
		expect(DEFAULT_PIXEL_SIZE).toBe(1);
		// No saved choice (and here no storage at all): the default.
		expect(loadPixelSize()).toBe(1);
	});
});

describe('canvasLayout', () => {
	it('matches the reference at 3× on a 1× screen', () => {
		const l = canvasLayout(3, 1200, 900, 1);
		expect(l.physicalPerArt).toBe(3);
		expect([l.bufferWidth, l.bufferHeight]).toEqual([400, 300]);
		expect([l.cssWidth, l.cssHeight]).toEqual([1200, 900]);
	});

	it('uses whole physical pixels per art pixel on fractional screens', () => {
		// 3 × 1.25 = 3.75 rounds to 4; 3 × 1.5 = 4.5 rounds to 5.
		expect(canvasLayout(3, 1000, 1000, 1.25).physicalPerArt).toBe(4);
		expect(canvasLayout(3, 1000, 1000, 1.5).physicalPerArt).toBe(5);
		expect(canvasLayout(2, 1000, 1000, 2).physicalPerArt).toBe(4);
		for (const size of [2, 3, 4] as const) {
			for (const dpr of [1, 1.25, 1.5, 2, 3]) {
				expect(Number.isInteger(canvasLayout(size, 999, 777, dpr).physicalPerArt)).toBe(true);
			}
		}
	});

	it('covers the host with a whole number of art pixels', () => {
		const l = canvasLayout(3, 1001, 500, 1);
		expect(l.bufferWidth).toBe(334);
		expect(l.cssWidth).toBe(1002);
		expect(l.cssWidth).toBeGreaterThanOrEqual(1001);
		expect(l.cssWidth - 1001).toBeLessThan(3);
	});

	it('renders at the screen density, capped at 2, when off', () => {
		expect(canvasLayout(1, 1200, 800, 1)).toMatchObject({ bufferWidth: 1200, cssWidth: 1200 });
		expect(canvasLayout(1, 2400, 1600, 2)).toMatchObject({ bufferWidth: 2400, cssWidth: 1200 });
		// 3× screen: a buffer at 2× the CSS size, not 3×.
		expect(canvasLayout(1, 3600, 2400, 3)).toMatchObject({ bufferWidth: 2400, cssWidth: 1200 });
	});

	it('never makes an empty buffer', () => {
		const l = canvasLayout(4, 0, 0, 1);
		expect(l.bufferWidth).toBeGreaterThanOrEqual(1);
		expect(l.bufferHeight).toBeGreaterThanOrEqual(1);
	});
});
