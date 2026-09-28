import {
	AmbientLight,
	BoxGeometry,
	DirectionalLight,
	EdgesGeometry,
	GridHelper,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshLambertMaterial,
	PerspectiveCamera,
	Scene,
	Vector3
} from 'three';
import { disposeObject } from '../engine';
import { makeLabel, removeLabels, type Label } from '../labels';
import type { View } from './View';

/**
 * A placeholder that proves the engine (M6.1 task P1): a spinning box with
 * hard amber edges over a grid, and one label. Diagonal edges show at once
 * whether art pixels are whole, even squares.
 */
export class TestView implements View {
	readonly scene = new Scene();
	readonly camera = new PerspectiveCamera(40, 1, 0.1, 100);
	readonly labels: Label[];
	readonly #box: Mesh;

	constructor(labelLayer: HTMLElement) {
		this.scene.add(new AmbientLight(0x8a98bd, 0.62 * Math.PI));
		const sun = new DirectionalLight(0xffffff, 0.7 * Math.PI);
		sun.position.set(-8, 20, 10);
		this.scene.add(sun);

		const geometry = new BoxGeometry(2, 2, 2);
		this.#box = new Mesh(
			geometry,
			new MeshLambertMaterial({
				color: 0x6c768c,
				// Faces sit just behind the edges, so edges never fight them for depth.
				polygonOffset: true,
				polygonOffsetFactor: 1,
				polygonOffsetUnits: 1
			})
		);
		this.#box.add(
			new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: 0xf2a93b }))
		);
		this.#box.position.y = 1.4;
		this.scene.add(this.#box);

		const grid = new GridHelper(12, 12, 0x2c4a5a, 0x1c2a40);
		this.scene.add(grid);

		this.camera.position.set(6, 5, 7);
		this.camera.lookAt(0, 1, 0);

		this.labels = [makeLabel(labelLayer, 'Test view · P1', 'amber', new Vector3(0, 2.9, 0), 4)];
	}

	resize(width: number, height: number): void {
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	enter(): void {}

	update(dt: number, _t: number, active: boolean): void {
		if (!active) return;
		this.#box.rotation.y += dt * 0.6;
		this.#box.rotation.x += dt * 0.25;
	}

	dispose(): void {
		disposeObject(this.scene);
		removeLabels(this.labels);
	}
}
