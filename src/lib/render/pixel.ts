/**
 * The pixel-art look (ADR 051): the scene is drawn into a small buffer and
 * scaled up with nearest-neighbour filtering. The pixel size is a player
 * setting: 1 (off), 2, 3 or 4 CSS pixels per art pixel.
 */
export type PixelSize = 1 | 2 | 3 | 4;

export const PIXEL_SIZES: readonly PixelSize[] = [1, 2, 3, 4];

export const DEFAULT_PIXEL_SIZE: PixelSize = 3;

const STORAGE_KEY = 'sleepers-px';

/** How the canvas is sized for a pixel size. */
export interface CanvasLayout {
	/** The drawing buffer, in art pixels. */
	bufferWidth: number;
	bufferHeight: number;
	/** The canvas's CSS size; may be up to one art pixel larger than the host. */
	cssWidth: number;
	cssHeight: number;
	/** Physical pixels per art pixel; not a whole number when off. */
	physicalPerArt: number;
}

/**
 * Sizes the buffer and canvas for a host of physicalWidth by physicalHeight
 * screen pixels. Off renders at min(devicePixelRatio, 2), as the reference
 * mockup does. At 2× to 4×, one art pixel covers k = round(size ×
 * devicePixelRatio) physical pixels, a whole number, so every art pixel is
 * the same square on any display; the canvas is made a whole number of art
 * pixels across, which may overhang the host's right and bottom edges by
 * less than one art pixel.
 */
export function canvasLayout(
	size: PixelSize,
	physicalWidth: number,
	physicalHeight: number,
	devicePixelRatio: number
): CanvasLayout {
	const w = Math.max(1, physicalWidth);
	const h = Math.max(1, physicalHeight);
	if (size === 1) {
		const perCss = Math.min(devicePixelRatio, 2);
		return {
			bufferWidth: Math.max(1, Math.round((w / devicePixelRatio) * perCss)),
			bufferHeight: Math.max(1, Math.round((h / devicePixelRatio) * perCss)),
			cssWidth: w / devicePixelRatio,
			cssHeight: h / devicePixelRatio,
			physicalPerArt: devicePixelRatio / perCss
		};
	}
	const k = Math.max(1, Math.round(size * devicePixelRatio));
	const bufferWidth = Math.ceil(w / k);
	const bufferHeight = Math.ceil(h / k);
	return {
		bufferWidth,
		bufferHeight,
		cssWidth: (bufferWidth * k) / devicePixelRatio,
		cssHeight: (bufferHeight * k) / devicePixelRatio,
		physicalPerArt: k
	};
}

/** The pixel size saved in this browser, or the default. */
export function loadPixelSize(): PixelSize {
	try {
		const saved = Number(localStorage.getItem(STORAGE_KEY));
		if ((PIXEL_SIZES as readonly number[]).includes(saved)) return saved as PixelSize;
	} catch {
		// Storage can be blocked; the default will do.
	}
	return DEFAULT_PIXEL_SIZE;
}

/** Remembers the pixel size in this browser, if storage allows. */
export function savePixelSize(size: PixelSize): void {
	try {
		localStorage.setItem(STORAGE_KEY, String(size));
	} catch {
		// Not remembered; nothing else depends on it.
	}
}
