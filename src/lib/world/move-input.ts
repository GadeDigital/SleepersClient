import type { Direction } from '$lib/proto/glyph/v1/world_pb';
import type { GameState } from '$lib/net/game-state.svelte';
import { DELTAS, directionOf } from './directions';

/** Keys that push toward an offset. Two held together make a diagonal. */
const KEYS: Record<string, [number, number]> = {
	KeyW: [0, -1],
	ArrowUp: [0, -1],
	KeyS: [0, 1],
	ArrowDown: [0, 1],
	KeyA: [-1, 0],
	ArrowLeft: [-1, 0],
	KeyD: [1, 0],
	ArrowRight: [1, 0],
	KeyQ: [-1, -1],
	KeyE: [1, -1],
	KeyZ: [-1, 1],
	KeyC: [1, 1]
};

/**
 * Send the follow-up move this many ticks before the current step arrives,
 * so it reaches the server in time to be queued (ADR 023) without leaving
 * much room to overshoot after the key is released.
 */
const LEAD_TICKS = 2;

/**
 * Turns held keys into move commands. It only asks: the server decides
 * whether each step happens (ADR 002).
 */
export class MoveInput {
	readonly #held = new Set<string>();
	readonly #game: GameState;
	readonly #move: (dir: Direction) => void;
	/** The step a follow-up was already sent for, by its start tick. */
	#followedStep = -1;

	constructor(game: GameState, move: (dir: Direction) => void) {
		this.#game = game;
		this.#move = move;
	}

	/** The direction the held keys point, or null. */
	get direction(): Direction | null {
		let dx = 0;
		let dy = 0;
		for (const code of this.#held) {
			dx += KEYS[code][0];
			dy += KEYS[code][1];
		}
		return directionOf(dx, dy);
	}

	/** Returns true if the key is a movement key, so the page should not scroll. */
	keydown(code: string, repeat: boolean): boolean {
		if (!(code in KEYS)) return false;
		if (repeat) return true;
		const before = this.direction;
		this.#held.add(code);
		const dir = this.direction;
		// A new direction is sent at once; a running step keeps it as the
		// queued action, replacing any older one.
		if (dir !== null && dir !== before) this.#send(dir);
		return true;
	}

	keyup(code: string): void {
		this.#held.delete(code);
	}

	/** Forget held keys, as when the window loses focus. */
	release(): void {
		this.#held.clear();
	}

	/** Called every frame: keeps walking while a key is held. */
	update(tickNow: number): void {
		const dir = this.direction;
		const step = this.#game.me?.step;
		if (dir === null || !step || this.#game.pendingMove !== null) return;
		if (step.startTick === this.#followedStep) return;
		if (step.arriveTick - tickNow <= LEAD_TICKS) this.#send(dir);
	}

	#send(dir: Direction): void {
		const step = this.#game.me?.step;
		// A command sent during a step is its follow-up; don't send another.
		if (step) this.#followedStep = step.startTick;
		this.#move(dir);
	}
}

/** The tile a queued move would step to from (x, y). */
export function queuedTarget(x: number, y: number, dir: Direction): [number, number] {
	const [dx, dy] = DELTAS[dir];
	return [x + dx, y + dy];
}
