/** Server ticks per second (ADR 012). */
export const TICKS_PER_SECOND = 10;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;

/** How many recent samples the estimate is taken from. */
const WINDOW = 10;

/**
 * Estimates the server's current tick from the ticks it reports.
 *
 * Every message carrying a tick was sent on that tick, then delayed by the
 * network. The least-delayed recent sample gives the best estimate, so the
 * clock keeps the latest few and uses whichever puts the server furthest
 * ahead. The estimate is only ever used to animate (ADR 002, ADR 026).
 */
export class TickClock {
	/** Server time minus local time, in ms, for each recent sample. */
	#offsets: number[] = [];

	get synced(): boolean {
		return this.#offsets.length > 0;
	}

	/** Records that the server was on `tick` at local time `nowMs`. */
	sample(tick: number, nowMs: number): void {
		this.#offsets.push(tick * MS_PER_TICK - nowMs);
		if (this.#offsets.length > WINDOW) this.#offsets.shift();
	}

	/** The estimated server tick at local time `nowMs`, with a fraction. */
	now(nowMs: number): number {
		if (!this.synced) return 0;
		return (nowMs + Math.max(...this.#offsets)) / MS_PER_TICK;
	}
}
