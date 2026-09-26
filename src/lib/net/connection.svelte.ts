import { create, fromBinary, toBinary, type MessageInitShape } from '@bufbuild/protobuf';
import {
	ClientMessageSchema,
	ServerMessageSchema,
	type ClientMessage
} from '$lib/proto/glyph/v1/messages_pb';
import type { ActionKind, Direction, SpeechMode } from '$lib/proto/glyph/v1/world_pb';
import { GameState } from './game-state.svelte';

export type Status = 'idle' | 'connecting' | 'joined' | 'closed';

/**
 * The server's WebSocket address. Set VITE_SERVER_URL to override; the
 * default is the game server on port 8080 of the host serving the page.
 */
export function defaultServerUrl(): string {
	return import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:8080/ws`;
}

/**
 * One connection to the game server. Each binary WebSocket message holds one
 * ClientMessage or ServerMessage envelope. The world the server describes is
 * in `game`.
 */
export class Connection {
	status = $state<Status>('idle');
	/** Why the connection closed, or why joining failed. */
	error = $state<string | null>(null);
	readonly game = new GameState();

	#url: string;
	#ws: WebSocket | null = null;

	constructor(url: string = defaultServerUrl()) {
		this.#url = url;
	}

	/**
	 * Connects and performs the dev login.
	 * DEVELOPMENT ONLY: the name is the whole identity, with no password.
	 */
	join(name: string): void {
		this.close();
		this.status = 'connecting';
		this.error = null;

		const ws = new WebSocket(this.#url);
		ws.binaryType = 'arraybuffer';
		this.#ws = ws;

		ws.onopen = () => this.#send({ message: { case: 'join', value: { name } } });
		ws.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
			const msg = fromBinary(ServerMessageSchema, new Uint8Array(ev.data));
			if (msg.message.case === 'worldSnapshot') this.status = 'joined';
			// Before the snapshot, a rejection is the reason the join failed.
			if (msg.message.case === 'commandRejected' && this.status !== 'joined') {
				this.error = msg.message.value.reason;
			}
			this.game.apply(msg, performance.now());
		};
		ws.onclose = (ev) => {
			if (this.#ws !== ws) return;
			this.#ws = null;
			this.status = 'closed';
			this.error ??= ev.reason || 'The connection to the server closed.';
		};
	}

	/** Asks for one step; the server decides whether it happens. */
	move(direction: Direction): void {
		if (this.status !== 'joined') return;
		this.game.pendingMove = direction;
		this.#send({ message: { case: 'move', value: { direction } } });
	}

	/** Asks for an action on the adjacent tile in direction; the server decides. */
	act(kind: ActionKind, direction: Direction): void {
		if (this.status !== 'joined') return;
		this.game.pendingMove = null;
		this.#send({ message: { case: 'act', value: { kind, direction } } });
	}

	/** Asks to say a line aloud; it may wait for the voice budget. */
	say(mode: SpeechMode, text: string): void {
		if (this.status !== 'joined') return;
		this.game.unspoken.push({ mode, text });
		this.#send({ message: { case: 'say', value: { mode, text } } });
	}

	/** DEVELOPMENT ONLY: jump to (x, y); the server must run with -dev-tools. */
	debugTeleport(x: number, y: number): void {
		if (this.status !== 'joined') return;
		this.#send({ message: { case: 'debugTeleport', value: { x, y } } });
	}

	/** DEVELOPMENT ONLY: ask for the whole planet overview. */
	debugOverview(): void {
		if (this.status !== 'joined') return;
		this.#send({ message: { case: 'debugOverviewRequest', value: {} } });
	}

	close(): void {
		const ws = this.#ws;
		this.#ws = null;
		ws?.close();
	}

	#send(init: MessageInitShape<typeof ClientMessageSchema>): void {
		const msg: ClientMessage = create(ClientMessageSchema, init);
		this.#ws?.send(toBinary(ClientMessageSchema, msg));
	}
}
