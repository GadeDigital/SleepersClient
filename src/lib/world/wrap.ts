/**
 * East-west wrapping (ADR 031). A planet's x runs from 0 to width-1 and then
 * starts again at 0, so any x has copies every width tiles. The world view
 * always draws the copy nearest the camera.
 */

/** The shortest signed difference d on a circle of the given period. */
export function wrapDelta(d: number, period: number): number {
	const m = (((d + period / 2) % period) + period) % period;
	return m - period / 2;
}

/** The copy of x (repeating every period) nearest to ref. */
export function nearest(x: number, ref: number, period: number): number {
	return ref + wrapDelta(x - ref, period);
}
