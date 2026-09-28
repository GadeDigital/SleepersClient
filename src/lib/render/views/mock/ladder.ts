import { cubeAddress } from '../../cubes';
import type { Engine } from '../../engine';
import { dragOrbit } from '../../orbit';
import { Transitions, type LadderView } from '../../transitions';
import { YOU } from './data';
import { DeckView } from './DeckView';
import { NAV_SPOT, roomAt } from './deckplan';
import { ExteriorView } from './ExteriorView';
import { GalaxyView } from './GalaxyView';
import { disposeMockTextures, makeMockTextures } from './helpers';
import { NestedView } from './NestedView';
import { OrbitView } from './OrbitView';

/** What the page shows; the ladder calls these, the page renders them. */
export interface LadderUi {
	/** The zoom changed: redraw the card, ladder and hint, and fade. */
	level(n: number): void;
	/** Shows a short message, or hides it. */
	toast(message: string | null): void;
	/** The address line or nav-station state changed. */
	status(address: string, navOpen: boolean): void;
}

const TOAST_SECONDS = 3.2;
const WHEEL_STEP = 60;
const WHEEL_LOCK_MS = 550;
/** Wait this long at the nav station before opening the zoom picked. */
const NAV_DELAY_MS = 300;

/**
 * The mockup's zoom ladder on mock data (brief section 6): six views, the
 * transitions, and the mockup's own rules for walking and the nav-station
 * lock. Those rules are the mockup's; in the game the server decides
 * (ADR 053), so none of this moves into the game.
 */
export class MockLadder {
	readonly #engine: Engine;
	readonly #ui: LadderUi;
	readonly #textures = makeMockTextures();
	readonly #deck: DeckView;
	readonly #views: Record<number, LadderView>;
	readonly #transitions: Transitions;
	/** A locked zoom picked while walking to the nav station. */
	#pending: number | null = null;
	#pendingTimer: ReturnType<typeof setTimeout> | undefined;
	#toastLeft = 0;
	#wheelAcc = 0;
	#wheelLock = 0;
	#down: { lx: number; ly: number; moved: number } | null = null;
	#lastAddress = '';
	#lastNav: boolean | null = null;

	constructor(engine: Engine, ui: LadderUi, reduceMotion: boolean) {
		this.#engine = engine;
		this.#ui = ui;
		const tex = this.#textures;
		const layer = engine.labelLayer;
		this.#deck = new DeckView(tex, layer, reduceMotion);
		this.#views = {
			1: this.#deck,
			2: new ExteriorView(tex, layer, reduceMotion),
			3: new NestedView(3, tex, layer, reduceMotion),
			4: new NestedView(4, tex, layer, reduceMotion),
			5: new NestedView(5, tex, layer, reduceMotion),
			6: new GalaxyView(tex, layer, reduceMotion)
		};
		// The deck goes first, so the engine makes it active (entered from above).
		for (let n = 1; n <= 6; n++) engine.add(this.#views[n]);
		this.#transitions = new Transitions(engine, this.#views, 1, reduceMotion, (n) => {
			this.#lastAddress = '';
			this.#lastNav = null;
			this.#setCursor();
			ui.level(n);
		});
		engine.onFrame = (dt) => this.#frame(dt);
		this.#setCursor();
		ui.level(1);
	}

	get level(): number {
		return this.#transitions.current;
	}

	/** Zooms 3 to 6 open at the nav station; once there, they stay open. */
	get navOpen(): boolean {
		return this.level >= 3 || this.#deck.atNav();
	}

	/** Picks a zoom, from a ladder rung, a number key or the wheel. */
	setLevel(target: number): void {
		const n = Math.max(1, Math.min(6, target));
		if (n === this.level) return;
		if (n >= 3 && !this.navOpen) {
			this.#pending = n;
			this.#toast(`Walking to the nav station. Zoom ${n} opens when you get there.`);
			if (this.level !== 1) this.#transitions.jump(1);
			if (!this.#deck.atNav()) this.#deck.walkPlayer(NAV_SPOT[0], NAV_SPOT[1]);
			return;
		}
		this.#transitions.request(n);
	}

	keydown(e: KeyboardEvent): void {
		if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
		if (e.key >= '1' && e.key <= '6') this.setLevel(Number(e.key));
		else if ((e.key === 'q' || e.key === 'Q') && this.level === 1) this.#deck.rotate(-1);
		else if ((e.key === 'e' || e.key === 'E') && this.level === 1) this.#deck.rotate(1);
	}

	/** One zoom step per wheel gesture. */
	wheel(e: WheelEvent): void {
		e.preventDefault();
		const now = performance.now();
		if (now < this.#wheelLock) return;
		this.#wheelAcc += e.deltaY;
		if (Math.abs(this.#wheelAcc) <= WHEEL_STEP) return;
		const target = this.level + (this.#wheelAcc > 0 ? 1 : -1);
		this.#wheelAcc = 0;
		this.#wheelLock = now + WHEEL_LOCK_MS;
		if (target >= 3 && !this.navOpen) {
			this.#toast('Zooms 3–6 need the nav station. Pick one on the ladder to walk there.');
			return;
		}
		this.setLevel(target);
	}

	pointerdown(e: PointerEvent): void {
		this.#down = { lx: e.clientX, ly: e.clientY, moved: 0 };
		try {
			(e.currentTarget as Element).setPointerCapture(e.pointerId);
		} catch {
			// Capture is a nicety; dragging still works without it.
		}
	}

	pointermove(e: PointerEvent): void {
		const down = this.#down;
		if (down) {
			const dx = e.clientX - down.lx;
			const dy = e.clientY - down.ly;
			down.lx = e.clientX;
			down.ly = e.clientY;
			down.moved += Math.abs(dx) + Math.abs(dy);
			const view = this.#views[this.level];
			if (view instanceof OrbitView && down.moved > 4) dragOrbit(view.orbit, dx, dy);
		}
		if (this.level === 1 && e.pointerType === 'mouse') this.#deck.setHover(this.#tileUnder(e));
	}

	/** A press and release moving less than 8 px on the deck walks there. */
	pointerup(e: PointerEvent): void {
		if (this.#down && this.#down.moved < 8 && this.level === 1) {
			const t = this.#tileUnder(e);
			if (t) {
				this.#pending = null;
				this.#deck.walkPlayer(t[0], t[1]);
			}
		}
		this.#down = null;
	}

	pointerleave(): void {
		this.#deck.setHover(null);
	}

	/** Frees the shared textures; the engine frees the views. */
	dispose(): void {
		clearTimeout(this.#pendingTimer);
		this.#engine.onFrame = () => {};
		disposeMockTextures(this.#textures);
	}

	#tileUnder(e: PointerEvent): [number, number] | null {
		const r = this.#engine.renderer.domElement.getBoundingClientRect();
		return this.#deck.tileUnder(
			((e.clientX - r.left) / r.width) * 2 - 1,
			-((e.clientY - r.top) / r.height) * 2 + 1
		);
	}

	#setCursor(): void {
		this.#engine.renderer.domElement.style.cursor = this.level === 1 ? 'pointer' : 'grab';
	}

	#toast(message: string): void {
		this.#toastLeft = TOAST_SECONDS;
		this.#ui.toast(message);
	}

	#address(): string {
		const n = this.level;
		if (n === 1) {
			const [x, z] = this.#deck.playerTile();
			return `Ship map · deck 1 · tile (${x}, ${z}) · ${roomAt(x, z)}`;
		}
		if (n === 2) return 'System KX-4417 · 1.2 AU from the star · under way';
		return cubeAddress(YOU, n as 3 | 4 | 5 | 6);
	}

	#frame(dt: number): void {
		this.#transitions.update(dt);
		if (this.#pending !== null && this.#deck.atNav()) {
			const level = this.#pending;
			this.#pending = null;
			this.#pendingTimer = setTimeout(() => this.setLevel(level), NAV_DELAY_MS);
		}
		if (this.#toastLeft > 0) {
			this.#toastLeft -= dt;
			if (this.#toastLeft <= 0) this.#ui.toast(null);
		}
		const address = this.#address();
		const nav = this.navOpen;
		if (address !== this.#lastAddress || nav !== this.#lastNav) {
			this.#lastAddress = address;
			this.#lastNav = nav;
			this.#ui.status(address, nav);
		}
	}
}
