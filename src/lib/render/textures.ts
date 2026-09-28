import { CanvasTexture, NearestFilter } from 'three';

/**
 * Small canvas textures, with the exact recipes of the reference mockup
 * (docs/reference/zoom-ladder-mockup.html in sleepers-server). Each call
 * makes a new texture; its owner disposes of it.
 */

/** A texture drawn on a w by h canvas; nearest keeps its pixels hard-edged. */
export function canvasTexture(
	w: number,
	h: number,
	draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
	nearest = false
): CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const g = canvas.getContext('2d');
	if (!g) throw new Error('2D canvas unavailable');
	draw(g, w, h);
	const t = new CanvasTexture(canvas);
	if (nearest) {
		t.magFilter = NearestFilter;
		t.minFilter = NearestFilter;
		t.generateMipmaps = false;
	}
	return t;
}

/** A soft white glow for sprites, tinted by the material colour. */
export function glowTexture(): CanvasTexture {
	return canvasTexture(64, 64, (g) => {
		const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		gr.addColorStop(0, 'rgba(255,255,255,1)');
		gr.addColorStop(0.18, 'rgba(255,255,255,0.85)');
		gr.addColorStop(0.45, 'rgba(255,255,255,0.2)');
		gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr;
		g.fillRect(0, 0, 64, 64);
	});
}

/** The heat-haze falloff for Hydra range: bright core, teal, deep blue, no hard edge. */
export function heatTexture(): CanvasTexture {
	return canvasTexture(128, 128, (g) => {
		const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
		gr.addColorStop(0, 'rgba(220,255,250,0.9)');
		gr.addColorStop(0.15, 'rgba(111,214,208,0.55)');
		gr.addColorStop(0.4, 'rgba(40,140,160,0.25)');
		gr.addColorStop(0.7, 'rgba(30,70,140,0.08)');
		gr.addColorStop(1, 'rgba(20,40,110,0)');
		g.fillStyle = gr;
		g.fillRect(0, 0, 128, 128);
	});
}

/** A round dot for star points. */
export function dotTexture(): CanvasTexture {
	return canvasTexture(16, 16, (g) => {
		g.fillStyle = '#fff';
		g.beginPath();
		g.arc(8, 8, 7, 0, Math.PI * 2);
		g.fill();
	});
}

/** A thin ring, for the expanding "you are here" marker. */
export function ringTexture(): CanvasTexture {
	return canvasTexture(64, 64, (g) => {
		g.strokeStyle = '#fff';
		g.lineWidth = 4;
		g.beginPath();
		g.arc(32, 32, 26, 0, Math.PI * 2);
		g.stroke();
	});
}

/** The "z" that rises over sleepers. */
export function zTexture(): CanvasTexture {
	return canvasTexture(
		32,
		32,
		(g) => {
			g.fillStyle = '#fff';
			g.font = 'bold 24px monospace';
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			g.fillText('z', 16, 17);
		},
		true
	);
}

/** A 16 × 16 hull panel, tinted per instance. */
export function panelTexture(): CanvasTexture {
	return canvasTexture(
		16,
		16,
		(g) => {
			g.fillStyle = '#d4d9e3';
			g.fillRect(0, 0, 16, 16);
			g.fillStyle = '#9aa1b0';
			g.fillRect(0, 0, 16, 1);
			g.fillRect(0, 0, 1, 16);
			g.fillStyle = '#e6eaf1';
			g.fillRect(1, 1, 14, 1);
			g.fillStyle = '#b3b9c6';
			g.fillRect(8, 1, 1, 7);
			g.fillRect(1, 8, 15, 1);
			g.fillStyle = '#8a91a0';
			g.fillRect(3, 3, 1, 1);
			g.fillRect(12, 12, 1, 1);
			g.fillRect(12, 3, 1, 1);
		},
		true
	);
}
