import type { CharacterView } from '$lib/net/game-state.svelte';

/**
 * Where to draw a character at estimated server tick `tickNow`, in tiles.
 *
 * During a step the character glides from its origin to its destination
 * over the step's ticks, and waits at the destination until CharacterMoved
 * confirms it. This is purely visual: the server alone moves characters
 * (ADR 002, ADR 023).
 */
export function glidePosition(c: CharacterView, tickNow: number): [number, number] {
	const s = c.step;
	if (!s) return [c.x, c.y];
	const span = s.arriveTick - s.startTick;
	const t = span > 0 ? Math.min(1, Math.max(0, (tickNow - s.startTick) / span)) : 1;
	return [s.fromX + (s.toX - s.fromX) * t, s.fromY + (s.toY - s.fromY) * t];
}
