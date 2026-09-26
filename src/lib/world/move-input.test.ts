import { describe, expect, it } from 'vitest';
import { GameState } from '$lib/net/game-state.svelte';
import { CharacterState, Direction } from '$lib/proto/glyph/v1/world_pb';
import { MoveInput } from './move-input';

function setup() {
	const game = new GameState();
	game.myId = 1;
	game.characters = {
		1: { id: 1, name: 'Ana', x: 1, y: 1, state: CharacterState.AWAKE, step: null }
	};
	const sent: Direction[] = [];
	const input = new MoveInput(game, (dir) => {
		game.pendingMove = dir;
		sent.push(dir);
	});
	return { game, input, sent };
}

/** The server started our step: the pending move is used up. */
function startStep(game: GameState, startTick: number) {
	game.characters[1].step = {
		fromX: 1,
		fromY: 1,
		toX: 2,
		toY: 1,
		startTick,
		arriveTick: startTick + 5
	};
	game.pendingMove = null;
}

describe('MoveInput', () => {
	it('sends a move at once for a new direction, and ignores key repeat', () => {
		const { input, sent } = setup();
		expect(input.keydown('KeyD', false)).toBe(true);
		expect(input.keydown('KeyD', true)).toBe(true);
		expect(sent).toEqual([Direction.EAST]);
	});

	it('ignores keys that do not move', () => {
		const { input, sent } = setup();
		expect(input.keydown('KeyX', false)).toBe(false);
		expect(sent).toEqual([]);
	});

	it('combines two held keys into a diagonal', () => {
		const { input, sent } = setup();
		input.keydown('KeyW', false);
		input.keydown('KeyD', false);
		expect(sent).toEqual([Direction.NORTH, Direction.NORTH_EAST]);
	});

	it('sends one follow-up near the end of each step while a key is held', () => {
		const { game, input, sent } = setup();
		input.keydown('ArrowRight', false);
		startStep(game, 10);

		input.update(11); // early in the step
		expect(sent).toHaveLength(1);
		input.update(13); // two ticks before arrival
		expect(sent).toEqual([Direction.EAST, Direction.EAST]);

		game.pendingMove = null; // as if the server rejected it
		input.update(14);
		expect(sent).toHaveLength(2); // not again for the same step

		startStep(game, 15);
		input.update(18);
		expect(sent).toHaveLength(3);
	});

	it('stops after the key is released', () => {
		const { game, input, sent } = setup();
		input.keydown('KeyD', false);
		startStep(game, 10);
		input.keyup('KeyD');
		input.update(14);
		expect(sent).toHaveLength(1);
	});

	it('retries once per step duration while held and refused', () => {
		const { game, input, sent } = setup();
		input.update(20);
		input.keydown('KeyA', false); // sent at tick 20
		game.pendingMove = null; // refused: someone is in the way
		input.update(21);
		input.update(24);
		expect(sent).toHaveLength(1);
		input.update(25);
		expect(sent).toHaveLength(2);
		game.pendingMove = null;
		input.keyup('KeyA');
		input.update(40);
		expect(sent).toHaveLength(2);
	});
});
