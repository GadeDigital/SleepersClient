import { describe, expect, it } from 'vitest';
import { bubbleDuration } from './speech-bubble';

describe('bubbleDuration', () => {
	it('keeps longer lines up longer, from 3 s up to 8 s', () => {
		expect(bubbleDuration('')).toBe(3000);
		expect(bubbleDuration('hello')).toBe(3300);
		expect(bubbleDuration('x'.repeat(190))).toBe(8000);
	});
});
