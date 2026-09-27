import { describe, expect, it } from 'vitest';
import { SpeechMode } from '$lib/proto/sleepers/v1/world_pb';
import { parsePrefix } from './speech';

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
