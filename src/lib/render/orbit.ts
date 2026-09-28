import { Vector3, type PerspectiveCamera } from 'three';

/**
 * Orbit camera state for zooms 2 to 6 (ADR 053): a heading (theta) and tilt
 * (phi) around a target, at radius × factor. While a transition drives it,
 * target and factor ease towards the drive; otherwise they settle back to
 * the centre and 1. After 2.5 s without dragging it slowly turns by itself.
 */
export interface Orbit {
	theta: number;
	phi: number;
	radius: number;
	target: Vector3;
	minPhi: number;
	maxPhi: number;
	factor: number;
	/** Seconds since the last drag. */
	idle: number;
	/** Auto-rotation speed, radians a second. */
	auto: number;
	drive: { target: Vector3; factor: number } | null;
}

export function makeOrbit(o: Partial<Orbit>): Orbit {
	return {
		theta: 0.8,
		phi: 1.05,
		radius: 50,
		target: new Vector3(),
		minPhi: 0.2,
		maxPhi: 1.5,
		factor: 1,
		idle: 99,
		auto: 0.05,
		drive: null,
		...o
	};
}

/** How long without dragging before the camera turns by itself. */
const IDLE_SPIN = 2.5;

const origin = new Vector3();

/** Eases the orbit for one frame and places the camera. */
export function applyOrbit(
	orb: Orbit,
	cam: PerspectiveCamera,
	dt: number,
	reduceMotion: boolean
): void {
	if (orb.drive) {
		// A transition: fly at, or pull back from, the player's position.
		const k = 1 - Math.exp(-dt * 7);
		orb.target.lerp(orb.drive.target, k);
		orb.factor += (orb.drive.factor - orb.factor) * k;
	} else {
		orb.factor += (1 - orb.factor) * (1 - Math.exp(-dt * 3.0));
		orb.target.lerp(origin, 1 - Math.exp(-dt * 2.4));
	}
	orb.idle += dt;
	if (orb.idle > IDLE_SPIN && !reduceMotion) orb.theta += orb.auto * dt;
	const r = orb.radius * orb.factor;
	cam.position.set(
		orb.target.x + r * Math.sin(orb.phi) * Math.sin(orb.theta),
		orb.target.y + r * Math.cos(orb.phi),
		orb.target.z + r * Math.sin(orb.phi) * Math.cos(orb.theta)
	);
	cam.lookAt(orb.target);
}

/** Turns the orbit by a drag of dx, dy CSS pixels. */
export function dragOrbit(orb: Orbit, dx: number, dy: number): void {
	orb.theta -= dx * 0.006;
	orb.phi = Math.max(orb.minPhi, Math.min(orb.maxPhi, orb.phi - dy * 0.005));
	orb.idle = 0;
}
