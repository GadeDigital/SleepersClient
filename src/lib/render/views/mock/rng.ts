/**
 * Seeded randomness for the mockup's decoration, so it looks the same on
 * every load. Decoration only: never world generation or game content.
 */
export type Rand = () => number;

/** mulberry32, as in the reference mockup: a number in [0, 1). */
export function mulberry32(seed: number): Rand {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A standard normal number from rand (Box-Muller), as in the reference. */
export function gauss(rand: Rand): number {
	let u = 0;
	let v = 0;
	while (!u) u = rand();
	while (!v) v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
