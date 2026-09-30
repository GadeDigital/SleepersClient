import type { Engine } from './engine';
import type { View } from './views/View';

/** A camera's heading and tilt, carried from one view to the next (ADR 053). */
export interface Angles {
	theta: number;
	phi: number;
	/**
	 * Seconds since the last drag, so a slow spin carries on without a jolt;
	 * 0 from the deck, which has no spin.
	 */
	idle: number;
}

/** A view on the zoom ladder: what the transitions need from it. */
export interface LadderView extends View {
	angles(): Angles;
	/** Takes the heading and tilt of the view it is replacing. */
	takeAngles(a: Angles): void;
	/** Before the fade: fly at the player (zooming in) or pull back (zooming out). */
	preMove(zoomingIn: boolean): void;
	endPreMove(): void;
}

/** How long the camera moves before the switch, in seconds. */
const PRE_MOVE = 0.45;

/**
 * The zoom state machine (ADR 053, brief section 6.3): a switch first moves
 * the current camera, then carries its angles over, makes the next view
 * active and fades. One transition at a time; with reduced motion, the
 * switch is instant.
 */
export class Transitions {
	readonly #engine: Engine;
	readonly #views: Readonly<Record<number, LadderView>>;
	readonly #reduceMotion: boolean;
	readonly #onSwitch: (level: number) => void;
	#current: number;
	#pending: { level: number; left: number } | null = null;

	constructor(
		engine: Engine,
		views: Readonly<Record<number, LadderView>>,
		first: number,
		reduceMotion: boolean,
		onSwitch: (level: number) => void
	) {
		this.#engine = engine;
		this.#views = views;
		this.#current = first;
		this.#reduceMotion = reduceMotion;
		this.#onSwitch = onSwitch;
	}

	get current(): number {
		return this.#current;
	}

	get busy(): boolean {
		return this.#pending !== null;
	}

	/** Starts a move to another zoom; ignored while one is running. */
	request(level: number): void {
		if (level === this.#current || this.#pending) return;
		if (this.#reduceMotion) {
			this.#switch(level);
			return;
		}
		this.#views[this.#current].preMove(level < this.#current);
		this.#pending = { level, left: PRE_MOVE };
	}

	/**
	 * Goes straight to a zoom, entered as if zooming in, with no camera move
	 * and no carried angles; as the reference does when a locked zoom sends
	 * the player back to the deck. A move still under way is dropped.
	 */
	jump(level: number): void {
		if (this.#pending) {
			this.#views[this.#current].endPreMove();
			this.#pending = null;
		}
		this.#current = level;
		this.#engine.setActive(this.#views[level], -1);
		this.#onSwitch(level);
	}

	/** Called every frame. */
	update(dt: number): void {
		if (!this.#pending) return;
		this.#pending.left -= dt;
		if (this.#pending.left <= 0) {
			const { level } = this.#pending;
			this.#pending = null;
			this.#switch(level);
		}
	}

	#switch(level: number): void {
		const from = this.#views[this.#current];
		const to = this.#views[level];
		from.endPreMove();
		to.takeAngles(from.angles());
		const direction = level > this.#current ? 1 : -1;
		this.#current = level;
		this.#engine.setActive(to, direction);
		this.#onSwitch(level);
	}
}
