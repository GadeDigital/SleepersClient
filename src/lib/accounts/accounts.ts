import { create, fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import {
	AccountSchema,
	CharacterSummarySchema,
	CreateCharacterRequestSchema,
	ErrorResponseSchema,
	type Account,
	type CharacterSummary
} from '$lib/proto/glyph/v1/accounts_pb';

/**
 * The account service's API (ADR 043, ADR 048): JSON bodies from the proto
 * messages, with the player's access token.
 */

const base = (import.meta.env.VITE_ACCOUNTS_URL as string | undefined) ?? 'http://127.0.0.1:8081';

async function call(token: string, path: string, init: RequestInit = {}): Promise<JsonValue> {
	const res = await fetch(base + path, {
		...init,
		headers: {
			...init.headers,
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});
	const body = (await res.json().catch(() => null)) as JsonValue;
	if (!res.ok) {
		const message = body
			? fromJson(ErrorResponseSchema, body, { ignoreUnknownFields: true }).message
			: '';
		throw new Error(message || `the account service answered ${res.status}`);
	}
	return body;
}

/** The signed-in player's account and characters, made on the first call. */
export async function fetchAccount(token: string): Promise<Account> {
	return fromJson(AccountSchema, await call(token, '/v1/account'), { ignoreUnknownFields: true });
}

/** Makes a character, if the account's tier has a free slot. */
export async function createCharacter(token: string, name: string): Promise<CharacterSummary> {
	const body = toJson(CreateCharacterRequestSchema, create(CreateCharacterRequestSchema, { name }));
	return fromJson(
		CharacterSummarySchema,
		await call(token, '/v1/characters', { method: 'POST', body: JSON.stringify(body) }),
		{ ignoreUnknownFields: true }
	);
}
