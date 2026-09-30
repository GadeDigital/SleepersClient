import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { disposeObject } from '../../engine';
import { removeLabels, type Label } from '../../labels';
import { applyOrbit, makeOrbit, type Orbit } from '../../orbit';
import type { Angles, LadderView } from '../../transitions';

/** How the view starts when entered, before easing back to normal. */
export interface EnterFrom {
	/** Zoomed out into from the zoom below: start small, on the player. */
	out: { factor: number; target: Vector3 | null };
	/** Zoomed in to from the zoom above: start large, on the centre. */
	in: { factor: number; target: Vector3 | null };
}

/**
 * The common part of the mockup's orbit views (zooms 2 to 6): a perspective
 * camera on an orbit, the transition moves and the carried angles.
 */
export abstract class OrbitView implements LadderView {
	readonly scene = new Scene();
	readonly camera: PerspectiveCamera;
	readonly labels: Label[] = [];
	readonly orbit: Orbit;
	/** Where a dive into the zoom below aims. */
	abstract readonly focus: Vector3;
	/** The orbit factor a dive ends at. */
	abstract readonly diveFactor: number;
	protected readonly reduceMotion: boolean;
	readonly #tallFov: number;
	readonly #enterFrom: EnterFrom;

	constructor(
		orbit: Partial<Orbit>,
		far: number,
		near: number,
		tallFov: number,
		enterFrom: EnterFrom,
		reduceMotion: boolean
	) {
		this.camera = new PerspectiveCamera(40, 1, near, far);
		this.orbit = makeOrbit(orbit);
		this.#tallFov = tallFov;
		this.#enterFrom = enterFrom;
		this.reduceMotion = reduceMotion;
	}

	resize(width: number, height: number): void {
		this.camera.aspect = width / height;
		this.camera.fov = width / height < 0.8 ? this.#tallFov : 40;
		this.camera.updateProjectionMatrix();
	}

	enter(direction: 1 | -1): void {
		if (this.reduceMotion) {
			this.orbit.factor = 1;
			return;
		}
		const from = direction > 0 ? this.#enterFrom.out : this.#enterFrom.in;
		this.orbit.factor = from.factor;
		if (from.target) this.orbit.target.copy(from.target);
	}

	/** Animations for this frame; the camera is placed afterwards. */
	protected abstract animate(dt: number, t: number): void;

	update(dt: number, t: number, active: boolean): void {
		if (!active) return;
		this.animate(dt, t);
		applyOrbit(this.orbit, this.camera, dt, this.reduceMotion);
	}

	angles(): Angles {
		return { theta: this.orbit.theta, phi: this.orbit.phi, idle: this.orbit.idle };
	}

	takeAngles(a: Angles): void {
		this.orbit.theta = a.theta;
		this.orbit.phi = Math.max(this.orbit.minPhi, Math.min(this.orbit.maxPhi, a.phi));
		this.orbit.idle = a.idle;
	}

	preMove(zoomingIn: boolean): void {
		this.orbit.drive = { target: this.focus, factor: zoomingIn ? this.diveFactor : 2.8 };
		this.orbit.idle = 0;
	}

	endPreMove(): void {
		this.orbit.drive = null;
	}

	dispose(): void {
		disposeObject(this.scene);
		removeLabels(this.labels);
	}
}
