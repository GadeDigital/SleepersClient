import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import { ServerMessageSchema } from '$lib/proto/glyph/v1/messages_pb';
import { ActionKind, CharacterState, Direction, SpeechMode } from '$lib/proto/glyph/v1/world_pb';
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
					tileTypes: [
						{ id: 1, name: 'floor', blocks: false, colour: 0x2a2d3a },
						{ id: 2, name: 'wall', blocks: true, colour: 0x6b6f80 }
					],
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

	it('keeps the tile catalogue and the chunks it holds', () => {
		const game = joined();
		expect(game.tileTypes.get(2)?.name).toBe('wall');
		const chunk = (cx: number, address = 'g/test') =>
			msg({
				message: {
					case: 'chunkData',
					value: { map: { address }, cx, cy: 0, tiles: [1, 2, 1], generatorVersion: 1 }
				}
			});
		game.apply(chunk(0), 0);
		game.apply(chunk(1), 0);
		game.apply(chunk(5, 'g/elsewhere'), 0);
		expect([...game.chunks.keys()]).toEqual(['0,0', '1,0']);
		expect([...(game.chunks.get('0,0')?.tiles ?? [])]).toEqual([1, 2, 1]);

		game.apply(msg({ message: { case: 'chunkUnloaded', value: { cx: 0, cy: 0 } } }), 0);
		expect([...game.chunks.keys()]).toEqual(['1,0']);
	});

	it('applies changed tiles and tracks actions under way', () => {
		const game = joined();
		game.apply(
			msg({
				message: {
					case: 'chunkData',
					value: { map: { address: 'g/test' }, cx: 1, cy: 0, tiles: new Array(32 * 32).fill(4) }
				}
			}),
			0
		);
		game.apply(
			msg({
				message: {
					case: 'tileChanged',
					value: { map: { address: 'g/test' }, position: { x: 33, y: 2 }, tileId: 9 }
				}
			}),
			0
		);
		const chunk = game.chunks.get('1,0');
		expect(chunk?.tiles[2 * 32 + 1]).toBe(9);
		expect(chunk?.version).toBe(1);

		game.apply(
			msg({
				message: {
					case: 'actionStarted',
					value: {
						characterId: 2,
						kind: ActionKind.DIG,
						target: { x: 3, y: 1 },
						startTick: 40n,
						endTick: 70n
					}
				}
			}),
			0
		);
		expect(game.characters[2].action).toEqual({
			kind: ActionKind.DIG,
			targetX: 3,
			targetY: 1,
			startTick: 40,
			endTick: 70
		});
	});
});
