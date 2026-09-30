import {
	ColorManagement,
	LinearSRGBColorSpace,
	Material,
	Texture,
	WebGLRenderer,
	type Object3D
} from 'three';
import { hideLabels, projectLabels } from './labels';
import { canvasLayout, DEFAULT_PIXEL_SIZE, type CanvasLayout, type PixelSize } from './pixel';
import type { View } from './views/View';

// Colours render as written, as in the reference mockup, which was made with
// three.js r128 before colour management existed (ADR 051).
ColorManagement.enabled = false;

/** The longest frame step, in seconds, so a stalled tab does not jump. */
const MAX_DT = 0.05;

/**
 * Owns the one WebGLRenderer and the render loop (ADR 051). Views never make
 * renderers: they are added here, updated every frame, and only the active
 * one is drawn and has its labels shown.
 */
export class Engine {
	readonly renderer: WebGLRenderer;
	/** The HTML layer over the canvas that views put their labels in. */
	readonly labelLayer: HTMLElement;
	/** Called after each layout, as when the pixel size or window changes. */
	onLayout: (layout: CanvasLayout) => void = () => {};
	/** Called each frame after the views update, before drawing. */
	onFrame: (dt: number, t: number) => void = () => {};

	readonly #canvas: HTMLCanvasElement;
	readonly #views: View[] = [];
	#active: View | null = null;
	#pixelSize: PixelSize = DEFAULT_PIXEL_SIZE;
	#host = { width: 1, height: 1, dpr: 1 };
	#layout: CanvasLayout;
	#raf = 0;
	#last = 0;
	#t = 0;
	#disposed = false;

	constructor(canvas: HTMLCanvasElement, labelLayer: HTMLElement) {
		this.#canvas = canvas;
		this.labelLayer = labelLayer;
		this.renderer = new WebGLRenderer({
			canvas,
			antialias: false,
			powerPreference: 'high-performance'
		});
		this.renderer.setClearColor(0x05070d, 1);
		this.renderer.outputColorSpace = LinearSRGBColorSpace;
		this.#layout = canvasLayout(this.#pixelSize, 1, 1, 1);
		document.addEventListener('visibilitychange', this.#visibility);
		this.#start();
	}

	get active(): View | null {
		return this.#active;
	}

	get layout(): CanvasLayout {
		return this.#layout;
	}

	get pixelSize(): PixelSize {
		return this.#pixelSize;
	}

	set pixelSize(size: PixelSize) {
		if (size === this.#pixelSize) return;
		this.#pixelSize = size;
		this.#relayout();
	}

	/** Adds a view, sized to the canvas; the first one added becomes active. */
	add(view: View): void {
		this.#views.push(view);
		view.resize(this.#layout.cssWidth, this.#layout.cssHeight, this.#layout.bufferHeight);
		if (!this.#active) this.setActive(view, -1);
	}

	/** Makes a view the one drawn, calling its enter. */
	setActive(view: View, direction: 1 | -1): void {
		if (this.#active) hideLabels(this.#active.labels);
		this.#active = view;
		view.enter(direction);
	}

	/**
	 * The host's size in physical pixels and the screen's devicePixelRatio,
	 * from a ResizeObserver.
	 */
	resize(physicalWidth: number, physicalHeight: number, devicePixelRatio: number): void {
		this.#host = { width: physicalWidth, height: physicalHeight, dpr: devicePixelRatio };
		this.#relayout();
	}

	/** Stops the loop and frees the renderer and every view. */
	dispose(): void {
		this.#disposed = true;
		cancelAnimationFrame(this.#raf);
		document.removeEventListener('visibilitychange', this.#visibility);
		for (const view of this.#views) view.dispose();
		this.#views.length = 0;
		this.#active = null;
		this.renderer.dispose();
	}

	#relayout(): void {
		const l = canvasLayout(this.#pixelSize, this.#host.width, this.#host.height, this.#host.dpr);
		this.#layout = l;
		// The buffer is set in art pixels; CSS stretches it by a whole number
		// of physical pixels, drawn nearest-neighbour by image-rendering. The
		// pixel ratio is buffer pixels per CSS pixel, as in the reference, so
		// sizes given in CSS pixels (such as PointsMaterial.size) match it.
		// The half pixel keeps floor() in setSize from losing a column.
		const ratio = l.bufferWidth / l.cssWidth;
		this.renderer.setPixelRatio(ratio);
		this.renderer.setSize((l.bufferWidth + 0.5) / ratio, (l.bufferHeight + 0.5) / ratio, false);
		this.#canvas.style.width = `${l.cssWidth}px`;
		this.#canvas.style.height = `${l.cssHeight}px`;
		for (const view of this.#views) view.resize(l.cssWidth, l.cssHeight, l.bufferHeight);
		this.onLayout(l);
	}

	#start(): void {
		this.#last = performance.now();
		this.#raf = requestAnimationFrame(this.#frame);
	}

	#visibility = (): void => {
		if (this.#disposed) return;
		cancelAnimationFrame(this.#raf);
		if (!document.hidden) this.#start();
	};

	#frame = (now: number): void => {
		if (this.#disposed || document.hidden) return;
		const dt = Math.min(Math.max(0, (now - this.#last) / 1000), MAX_DT);
		this.#last = now;
		this.#t += dt;
		for (const view of this.#views) view.update(dt, this.#t, view === this.#active);
		this.onFrame(dt, this.#t);
		const view = this.#active;
		if (view) {
			this.renderer.render(view.scene, view.camera);
			// Labels snap to the art-pixel grid: CSS pixels per art pixel (ADR 066).
			const l = this.#layout;
			projectLabels(view.labels, view.camera, l.cssWidth, l.cssHeight, l.cssWidth / l.bufferWidth);
		}
		this.#raf = requestAnimationFrame(this.#frame);
	};
}

/** Frees the geometries, materials and textures under an object. */
export function disposeObject(root: Object3D): void {
	root.traverse((o) => {
		// Meshes, lines, points and sprites all carry a geometry and material.
		if (!('geometry' in o)) return;
		const withGeometry = o as Object3D & { geometry?: { dispose(): void }; material?: unknown };
		withGeometry.geometry?.dispose();
		const materials = Array.isArray(withGeometry.material)
			? withGeometry.material
			: [withGeometry.material];
		for (const m of materials) {
			if (!(m instanceof Material)) continue;
			for (const value of Object.values(m)) if (value instanceof Texture) value.dispose();
			m.dispose();
		}
	});
}
