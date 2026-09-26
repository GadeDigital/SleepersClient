import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import { ServerMessageSchema } from '$lib/proto/glyph/v1/messages_pb';
import { CharacterState, Direction, SpeechMode } from '$lib/proto/glyph/v1/world_pb';
import { GameState, LOG_LIMIT } from './game-state.svelte';

function msg(init: MessageInitShape<typeof ServerMessageSchema>) {
	return create(ServerMessageSchema, init);
}

const AWAKE = CharacterState.AWAKE;

function joined(): GameState {
	const game = new GameState();
	game.apply(
		msg({
			message: {
				case: 'worldSnapshot',
				value: {
					yourCharacterId: 1,
					tick: 30n,
					map: { ref: { address: 'g/test' }, width: 64, height: 64, wrapsX: true, chunkSize: 32 },
					characters: [
						{ id: 1, name: 'Ana', position: { x: 1, y: 1 }, state: AWAKE },
						{ id: 2, name: 'Ben', position: { x: 2, y: 1 }, state: AWAKE }
					]
				}
			}
		}),
		0
	);
	return game;
}

describe('GameState', () => {
	it('takes the map, characters and tick from the snapshot', () => {
		const game = joined();
		expect(game.map?.width).toBe(64);
		expect(game.me?.name).toBe('Ana');
		expect(Object.keys(game.characters)).toHaveLength(2);
		expect(game.clock.now(0)).toBe(30);
	});

	it('records a step, then moves on CharacterMoved', () => {
		const game = joined();
		game.pendingMove = Direction.EAST;
		game.apply(
			msg({
				message: {
					case: 'stepStarted',
					value: {
						characterId: 1,
						from: { x: 1, y: 1 },
						to: { x: 2, y: 2 },
						startTick: 31n,
						arriveTick: 36n
					}
				}
			}),
			100
		);
		expect(game.me?.step).toEqual({
			fromX: 1,
			fromY: 1,
			toX: 2,
			toY: 2,
			startTick: 31,
			arriveTick: 36
		});
		expect(game.me?.x).toBe(1);
		expect(game.pendingMove).toBeNull();

		game.apply(
			msg({
				message: {
					case: 'characterMoved',
					value: { characterId: 1, position: { x: 2, y: 2 }, tick: 36n }
				}
			}),
			600
		);
		expect(game.me?.step).toBeNull();
		expect([game.me?.x, game.me?.y]).toEqual([2, 2]);
	});

	it('tracks appearing, state changes and leaving', () => {
		const game = joined();
		game.apply(
			msg({
				message: {
					case: 'characterAppeared',
					value: { character: { id: 3, name: 'Cai', position: { x: 3, y: 3 }, state: AWAKE } }
				}
			}),
			0
		);
		expect(game.characters[3].name).toBe('Cai');

		game.apply(
			msg({
				message: {
					case: 'characterStateChanged',
					value: { characterId: 2, state: CharacterState.UNCONSCIOUS }
				}
			}),
			0
		);
		expect(game.characters[2].state).toBe(CharacterState.UNCONSCIOUS);

		game.apply(msg({ message: { case: 'characterLeft', value: { characterId: 3 } } }), 0);
		expect(game.characters[3]).toBeUndefined();
	});

	it('clears the pending move when a command is rejected', () => {
		const game = joined();
		game.pendingMove = Direction.WEST;
		game.apply(
			msg({ message: { case: 'commandRejected', value: { reason: 'a wall is in the way' } } }),
			0
		);
		expect(game.pendingMove).toBeNull();
		expect(game.rejection).toBe('a wall is in the way');
	});

	it('resyncs the clock from TickSync', () => {
		const game = joined();
		game.apply(msg({ message: { case: 'tickSync', value: { tick: 50n } } }), 2000);
		expect(game.clock.now(2000)).toBe(50);
	});

	it('logs heard lines with the speaker and marks your own as spoken', () => {
		const game = joined();
		game.unspoken.push({ mode: SpeechMode.TALK, text: 'hi' });
		const heard = (speakerId: number, text: string, muffled = false) =>
			game.apply(
				msg({
					message: {
						case: 'heard',
						value: { speakerId, mode: SpeechMode.TALK, text, muffled, tick: 40n }
					}
				}),
				0
			);
		heard(2, 'hello … there', true);
		heard(1, 'hi');
		expect(game.unspoken).toHaveLength(0);
		expect(game.log.map((e) => [e.speaker, e.text, e.muffled, e.own])).toEqual([
			['Ben', 'hello … there', true, false],
			['Ana', 'hi', false, true]
		]);

		for (let i = 0; i < LOG_LIMIT + 5; i++) heard(2, `line ${i}`);
		expect(game.log).toHaveLength(LOG_LIMIT);
		expect(game.log.at(-1)?.text).toBe(`line ${LOG_LIMIT + 4}`);
	});
});
