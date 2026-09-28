import { describe, expect, it } from 'vitest';
import { SpeechMode } from '$lib/proto/sleepers/v1/world_pb';
import { bubbleDuration, parsePrefix } from './speech';

describe('parsePrefix', () => {
	it('reads /w, /t and /y and strips them', () => {
		expect(parsePrefix('/w psst')).toEqual({ mode: SpeechMode.WHISPER, rest: 'psst' });
		expect(parsePrefix('/y over here')).toEqual({ mode: SpeechMode.YELL, rest: 'over here' });
		expect(parsePrefix('/t')).toEqual({ mode: SpeechMode.TALK, rest: '' });
	});

	it('leaves other text alone', () => {
		expect(parsePrefix('hello')).toEqual({ mode: null, rest: 'hello' });
		expect(parsePrefix('/wave')).toEqual({ mode: null, rest: '/wave' });
	});
});

describe('bubbleDuration', () => {
	it('keeps longer lines up longer, from 3 s up to 8 s', () => {
		expect(bubbleDuration('')).toBe(3000);
		expect(bubbleDuration('hello')).toBe(3300);
		expect(bubbleDuration('x'.repeat(190))).toBe(8000);
	});
});
