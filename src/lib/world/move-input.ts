import { ActionKind, type Direction } from '$lib/proto/glyph/v1/world_pb';
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
 * While a key is held and the character stands still, as after a step was
 * refused, ask again this often: one step's duration (ADR 023). Someone
 * crossing your path then only holds you up until they have passed.
 */
const RETRY_TICKS = 5;

/** Keys that start aiming an action (ADR 039). */
const ACTION_KEYS: Record<string, ActionKind> = {
	KeyG: ActionKind.DIG,
	KeyB: ActionKind.BUILD_WALL,
	KeyX: ActionKind.REMOVE_WALL
};

/**
 * Turns held keys into move and action commands. It only asks: the server
 * decides whether each step or action happens (ADR 002).
 *
 * G, B or X starts aiming an action; while aiming, direction keys choose the
 * adjacent tile instead of walking, and releasing them sends the action at
 * the tile aimed at. The same key again, or Escape, stops aiming.
 */
export class MoveInput {
	readonly #held = new Set<string>();
	readonly #game: GameState;
	readonly #move: (dir: Direction) => void;
	readonly #act: (kind: ActionKind, dir: Direction) => void;
	readonly #onAiming: (kind: ActionKind | null) => void;
	/** The action being aimed, or null when walking. */
	#aiming: ActionKind | null = null;
	/** The step a follow-up was already sent for, by its start tick. */
	#followedStep = -1;
	/** The latest estimated tick seen by update. */
	#tick = 0;
	/** When the last command was sent, in estimated ticks. */
	#sentTick = -Infinity;

	constructor(
		game: GameState,
		move: (dir: Direction) => void,
		act: (kind: ActionKind, dir: Direction) => void = () => {},
		onAiming: (kind: ActionKind | null) => void = () => {}
	) {
		this.#game = game;
		this.#move = move;
		this.#act = act;
		this.#onAiming = onAiming;
	}

	/** The action being aimed, or null. */
	get aiming(): ActionKind | null {
		return this.#aiming;
	}

	#setAiming(kind: ActionKind | null): void {
		this.#aiming = kind;
		this.#held.clear();
		this.#onAiming(kind);
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

	/** Returns true if the key is one of ours, so the page should ignore it. */
	keydown(code: string, repeat: boolean): boolean {
		if (code in ACTION_KEYS) {
			if (!repeat) this.#setAiming(this.#aiming === ACTION_KEYS[code] ? null : ACTION_KEYS[code]);
			return true;
		}
		if (code === 'Escape' && this.#aiming !== null) {
			this.#setAiming(null);
			return true;
		}
		if (!(code in KEYS)) return false;
		if (repeat) return true;
		if (this.#aiming !== null) {
			this.#held.add(code); // aim only; the action goes on release
			return true;
		}
		const before = this.direction;
		this.#held.add(code);
		const dir = this.direction;
		// A new direction is sent at once; a running step keeps it as the
		// queued action, replacing any older one.
		if (dir !== null && dir !== before) this.#send(dir);
		return true;
	}

	keyup(code: string): void {
		if (this.#aiming !== null && this.#held.has(code)) {
			// Two keys held for a diagonal are rarely released together: the
			// first release sends the action at the direction aimed just then.
			const dir = this.direction;
			const kind = this.#aiming;
			this.#setAiming(null);
			if (dir !== null) this.#act(kind, dir);
			return;
		}
		this.#held.delete(code);
	}

	/** Forget held keys, as when the window loses focus. */
	release(): void {
		this.#held.clear();
		if (this.#aiming !== null) this.#setAiming(null);
	}

	/** Called every frame: keeps walking while a key is held. */
	update(tickNow: number): void {
		this.#tick = tickNow;
		if (this.#aiming !== null) return;
		const dir = this.direction;
		if (dir === null || this.#game.pendingMove !== null) return;
		const step = this.#game.me?.step;
		if (!step) {
			if (tickNow - this.#sentTick >= RETRY_TICKS) this.#send(dir);
			return;
		}
		if (step.startTick === this.#followedStep) return;
		if (step.arriveTick - tickNow <= LEAD_TICKS) this.#send(dir);
	}

	#send(dir: Direction): void {
		this.#sentTick = this.#tick;
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
