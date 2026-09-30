import { Vector3, type Camera } from 'three';

/** The label styles from the reference mockup. */
export type LabelVariant = 'amber' | 'cyan' | 'quiet' | '';

/**
 * Text over the world is HTML laid over the canvas, never drawn in 3D
 * (ADR 051), so it stays sharp at every pixel size.
 */
export interface Label {
	el: HTMLElement;
	/** Where the label points, in the view's scene; a function for moving things. */
	pos: Vector3 | (() => Vector3);
	/** How far above the point the label sits, in CSS pixels. */
	lift: number;
}

/** Adds a label to the layer, hidden until it is first projected. */
export function makeLabel(
	layer: HTMLElement,
	text: string,
	variant: LabelVariant,
	pos: Label['pos'],
	lift = 12
): Label {
	const el = document.createElement('div');
	el.className = variant ? `lbl ${variant}` : 'lbl';
	el.textContent = text;
	el.style.visibility = 'hidden';
	layer.appendChild(el);
	return { el, pos, lift };
}

/**
 * Where a projected point lands on a width by height area, in CSS pixels,
 * or null when it is behind the camera or outside the view (normalised
 * coordinates past ±1.1), as in the reference mockup.
 */
export function screenPoint(
	ndc: { x: number; y: number; z: number },
	width: number,
	height: number
): [number, number] | null {
	if (ndc.z > 1 || ndc.z < -1 || Math.abs(ndc.x) > 1.1 || Math.abs(ndc.y) > 1.1) return null;
	return [(ndc.x * 0.5 + 0.5) * width, (-ndc.y * 0.5 + 0.5) * height];
}

/**
 * Rounds a CSS-pixel position to the art-pixel grid, so labels move in
 * step with the low-resolution scene (ADR 066); grid is CSS pixels per art
 * pixel. 0 leaves it as it is.
 */
export function snapToGrid(v: number, grid: number): number {
	return grid > 0 ? Math.round(v / grid) * grid : v;
}

const v = new Vector3();

/**
 * Places each label over its point for this frame, snapped to the art-pixel
 * grid (CSS pixels per art pixel), or hides it.
 */
export function projectLabels(
	labels: readonly Label[],
	camera: Camera,
	width: number,
	height: number,
	grid = 0
): void {
	for (const label of labels) {
		v.copy(typeof label.pos === 'function' ? label.pos() : label.pos).project(camera);
		const at = screenPoint(v, width, height);
		if (!at) {
			label.el.style.visibility = 'hidden';
			continue;
		}
		label.el.style.visibility = 'visible';
		const x = snapToGrid(at[0], grid);
		const y = snapToGrid(at[1], grid);
		label.el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) translate(-50%,-100%) translateY(${-label.lift}px)`;
	}
}

/** Hides labels, as for a view that is not active. */
export function hideLabels(labels: readonly Label[]): void {
	for (const label of labels) label.el.style.visibility = 'hidden';
}

/** Takes labels off the layer for good. */
export function removeLabels(labels: readonly Label[]): void {
	for (const label of labels) label.el.remove();
}
