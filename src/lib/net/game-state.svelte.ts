import type { ServerMessage } from '$lib/proto/glyph/v1/messages_pb';
import {
	CharacterState,
	type Character,
	type Direction,
	type MapInfo,
	type SpeechMode
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

/** A line you asked to say that the server has not spoken yet. */
export interface UnspokenLine {
	mode: SpeechMode;
	text: string;
}

/** One line in the chat log: something you heard, or said yourself. */
export interface ChatEntry {
	/** Numbers entries in arrival order; unique for the session. */
	seq: number;
	speakerId: number;
	/** The speaker's name when the line was heard. */
	speaker: string;
	mode: SpeechMode;
	text: string;
	muffled: boolean;
	own: boolean;
}

/** The oldest lines are forgotten beyond this many. */
export const LOG_LIMIT = 1000;

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
	/** The map you are on, from the snapshot; its ground arrives in chunks. */
	map = $state.raw<MapInfo | null>(null);
	/** The character this connection controls; 0 before the snapshot. */
	myId = $state(0);
	/** Everyone in view, by id. */
	characters = $state<Record<number, CharacterView>>({});
	/** The move sent but not yet started, shown as the queued action. */
	pendingMove = $state<Direction | null>(null);
	/** The server's reason for refusing the last command, if any. */
	rejection = $state<string | null>(null);
	/**
	 * Lines sent but not yet spoken, oldest first: they wait for the voice
	 * budget on the server (ADR 013). The server speaks them in order, so each
	 * of your own Heard lines is the oldest one here.
	 */
	unspoken = $state<UnspokenLine[]>([]);
	/** Everything heard, oldest first, up to LOG_LIMIT lines. */
	log = $state.raw<ChatEntry[]>([]);
	#seq = 0;

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
				this.map = m.value.map ?? null;
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
			case 'heard': {
				const h = m.value;
				const own = h.speakerId === this.myId;
				if (own) this.unspoken.shift();
				const entry: ChatEntry = {
					seq: ++this.#seq,
					speakerId: h.speakerId,
					speaker: this.characters[h.speakerId]?.name ?? 'Someone',
					mode: h.mode,
					text: h.text,
					muffled: h.muffled,
					own
				};
				// Replaced whole rather than pushed: the log can be long, and a raw
				// array avoids making every entry deeply reactive.
				this.log = [...this.log.slice(-(LOG_LIMIT - 1)), entry];
				break;
			}
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
