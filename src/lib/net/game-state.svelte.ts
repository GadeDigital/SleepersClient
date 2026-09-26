import type { ServerMessage } from '$lib/proto/glyph/v1/messages_pb';
import {
	CharacterState,
	type Character,
	type Direction,
	type Room
} from '$lib/proto/glyph/v1/world_pb';
import { TickClock } from './tick-clock';

/** A step in progress, as announced by StepStarted (ADR 023). */
export interface Step {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	startTick: number;
	arriveTick: number;
}

/** What the client knows about one character: only what the server said. */
export interface CharacterView {
	id: number;
	name: string;
	/** The tile the server last placed the character on. */
	x: number;
	y: number;
	state: CharacterState;
	step: Step | null;
}

/**
 * The world as the server has described it, kept as reactive state.
 *
 * It applies server messages and nothing else: no rule is checked or
 * predicted here (ADR 002).
 */
export class GameState {
	/** The room, replaced whole by each snapshot. */
	room = $state.raw<Room | null>(null);
	/** The character this connection controls; 0 before the snapshot. */
	myId = $state(0);
	/** Everyone in view, by id. */
	characters = $state<Record<number, CharacterView>>({});
	/** The move sent but not yet started, shown as the queued action. */
	pendingMove = $state<Direction | null>(null);
	/** The server's reason for refusing the last command, if any. */
	rejection = $state<string | null>(null);

	/** Not reactive: read every frame by the renderer. */
	readonly clock = new TickClock();

	get me(): CharacterView | undefined {
		return this.characters[this.myId];
	}

	/** Applies one server message received at local time `nowMs`. */
	apply(msg: ServerMessage, nowMs: number): void {
		const m = msg.message;
		switch (m.case) {
			case 'worldSnapshot': {
				this.clock.sample(Number(m.value.tick), nowMs);
				this.room = m.value.room ?? null;
				this.myId = m.value.yourCharacterId;
				const characters: Record<number, CharacterView> = {};
				for (const c of m.value.characters) characters[c.id] = view(c);
				this.characters = characters;
				break;
			}
			case 'characterAppeared':
				if (m.value.character) this.characters[m.value.character.id] = view(m.value.character);
				break;
			case 'stepStarted': {
				const s = m.value;
				this.clock.sample(Number(s.startTick), nowMs);
				const c = this.characters[s.characterId];
				if (c) {
					c.step = {
						fromX: s.from?.x ?? c.x,
						fromY: s.from?.y ?? c.y,
						toX: s.to?.x ?? c.x,
						toY: s.to?.y ?? c.y,
						startTick: Number(s.startTick),
						arriveTick: Number(s.arriveTick)
					};
				}
				// Our command has started, so nothing is queued any more.
				if (s.characterId === this.myId) this.pendingMove = null;
				break;
			}
			case 'characterMoved': {
				this.clock.sample(Number(m.value.tick), nowMs);
				const c = this.characters[m.value.characterId];
				if (c) {
					c.x = m.value.position?.x ?? c.x;
					c.y = m.value.position?.y ?? c.y;
					c.step = null;
				}
				break;
			}
			case 'characterStateChanged': {
				const c = this.characters[m.value.characterId];
				if (c) c.state = m.value.state;
				break;
			}
			case 'characterLeft':
				delete this.characters[m.value.characterId];
				break;
			case 'tickSync':
				this.clock.sample(Number(m.value.tick), nowMs);
				break;
			case 'commandRejected':
				this.pendingMove = null;
				this.rejection = m.value.reason;
				break;
		}
	}
}

function view(c: Character): CharacterView {
	return {
		id: c.id,
		name: c.name,
		x: c.position?.x ?? 0,
		y: c.position?.y ?? 0,
		state: c.state,
		step: null
	};
}

export function isUnconscious(c: CharacterView): boolean {
	return c.state === CharacterState.UNCONSCIOUS;
}
