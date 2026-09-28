import type { Direction } from '$lib/proto/sleepers/v1/world_pb';
import { directionOf } from './directions';

/**
 * Movement keys are relative to the screen (ADR 057): "up" moves towards the
 * top of the screen whichever way the camera faces.
 *
 * The camera looks at the ground from heading h: it sits at (sin h, cos h)
 * from its target on the ground plane, where x grows east and y south. Up
 * the screen is then the ground direction (−sin h, −cos h), and right is
 * (cos h, −sin h). At the game's default heading of π/4, up is north-west.
 */
export function screenToGrid(right: number, up: number, heading: number): Direction | null {
	const vx = right * Math.cos(heading) - up * Math.sin(heading);
	const vy = -right * Math.sin(heading) - up * Math.cos(heading);
	if (Math.hypot(vx, vy) < 1e-6) return null;
	// The nearest of the 8 grid directions, in steps of 45°.
	const k = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
	return directionOf(
		Math.round(Math.cos((k * Math.PI) / 4)),
		Math.round(Math.sin((k * Math.PI) / 4))
	);
}
