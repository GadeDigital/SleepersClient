/**
 * Size of one tile in art pixels. A placeholder until the art size is agreed
 * with the artist (see open questions in the architecture doc).
 */
export const TILE_SIZE = 16;

/**
 * How large one art pixel should look, in CSS pixels. The actual zoom is the
 * nearest whole number of physical pixels to this, so every art pixel covers
 * the same square of screen pixels at any browser zoom or display density.
 */
const TARGET_CSS_ZOOM = 3;

/** Physical pixels per art pixel for a devicePixelRatio: a whole number, at least 1. */
export function zoomFor(devicePixelRatio: number): number {
	return Math.max(1, Math.round(TARGET_CSS_ZOOM * devicePixelRatio));
}
