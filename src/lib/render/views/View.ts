import type { Camera, Scene, Vector3 } from 'three';
import type { Label } from '../labels';

/**
 * One view (a zoom level, or the game's tile view): its own scene, camera
 * and origin, kept out of Svelte state (ADR 051). The engine updates every
 * view each frame and draws only the active one.
 */
export interface View {
	readonly scene: Scene;
	readonly camera: Camera;
	readonly labels: readonly Label[];
	/** Where a dive into the zoom below aims, for views that orbit. */
	readonly focus?: Vector3;
	/**
	 * The canvas's CSS size changed; bufferHeight is its height in art
	 * pixels, for views that snap their camera to the art-pixel grid.
	 */
	resize(width: number, height: number, bufferHeight: number): void;
	/** The view becomes active: 1 when zooming out into it, -1 when zooming in. */
	enter(direction: 1 | -1): void;
	/**
	 * Called every frame. Inactive views may keep light state moving but
	 * should skip camera work.
	 */
	update(dt: number, t: number, active: boolean): void;
	/** Frees geometries, materials, textures and labels. */
	dispose(): void;
}
