import type { CharacterView } from '$lib/net/game-state.svelte';
import { wrapDelta } from './wrap';

/**
 * Where to draw a character at estimated server tick `tickNow`, in tiles.
 * On a map that wraps, pass its width; the result may then lie just outside
 * 0 to width-1, on the far side of the seam.
 *
 * During a step the character glides from its origin to its destination
 * over the step's ticks, and waits at the destination until CharacterMoved
 * confirms it. This is purely visual: the server alone moves characters
 * (ADR 002, ADR 023).
 */
export function glidePosition(
	c: CharacterView,
	tickNow: number,
	wrapWidth?: number
): [number, number] {
	const s = c.step;
	if (!s) return [c.x, c.y];
	const span = s.arriveTick - s.startTick;
	const t = span > 0 ? Math.min(1, Math.max(0, (tickNow - s.startTick) / span)) : 1;
	// Across the seam, x jumps from width-1 to 0: glide the short way round.
	const dx = wrapWidth ? wrapDelta(s.toX - s.fromX, wrapWidth) : s.toX - s.fromX;
	return [s.fromX + dx * t, s.fromY + (s.toY - s.fromY) * t];
}
