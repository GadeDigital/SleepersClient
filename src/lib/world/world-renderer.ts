import { Container, type Application } from 'pixi.js';

/**
 * Owns the Pixi scene for the world view. It draws what the game state holds
 * and never changes it (ADR 002). Pixi objects stay out of Svelte state: the
 * renderer reads the game state and updates its own display objects.
 */
export class WorldRenderer {
	/** Everything in world coordinates; the camera moves and scales it. */
	readonly #world = new Container();

	constructor(app: Application) {
		app.stage.addChild(this.#world);
	}

	destroy(): void {
		this.#world.destroy({ children: true });
	}
}
