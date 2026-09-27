import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

/**
 * Signing in through the identity provider, the standard OpenID Connect
 * way (ADR 042, ADR 048): the authorization code flow with PKCE, a refresh
 * token (offline_access) renewing the access token before it expires, and
 * tokens kept in sessionStorage, so a reload keeps you signed in but
 * closing the tab does not. Settings come from .env; nothing here is
 * specific to Auth0 except that it wants the API's audience asked for.
 */

const authority = import.meta.env.VITE_OIDC_AUTHORITY as string | undefined;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined;
const audience = import.meta.env.VITE_OIDC_AUDIENCE as string | undefined;

/** Whether signing in is set up in .env. */
export const signInConfigured = Boolean(authority && clientId && audience);

let manager: UserManager | null = null;

function users(): UserManager {
	if (!signInConfigured) throw new Error('signing in is not set up: fill in .env');
	manager ??= new UserManager({
		authority: authority!,
		client_id: clientId!,
		redirect_uri: `${location.origin}/callback`,
		post_logout_redirect_uri: `${location.origin}/`,
		response_type: 'code',
		scope: 'openid profile offline_access',
		// Auth0 issues an access token for our API only if asked for it.
		extraQueryParams: { audience: audience! },
		userStore: new WebStorageStateStore({ store: window.sessionStorage }),
		automaticSilentRenew: true
	});
	return manager;
}

/** Sends the player to the provider's login page. */
export async function signIn(): Promise<void> {
	await users().signinRedirect();
}

/** Finishes signing in on the callback page. */
export async function completeSignIn(): Promise<void> {
	await users().signinRedirectCallback();
}

/**
 * A current access token, renewed with the refresh token if it has run
 * out, or null if the player is not signed in.
 */
export async function accessToken(): Promise<string | null> {
	if (!signInConfigured) return null;
	const u = users();
	let user = await u.getUser();
	if (user?.expired) {
		try {
			user = await u.signinSilent();
		} catch {
			await u.removeUser();
			return null;
		}
	}
	return user?.access_token ?? null;
}

/** Signs out here and at the provider, and comes back to the start page. */
export async function signOut(): Promise<void> {
	const u = users();
	try {
		await u.signoutRedirect();
	} catch {
		// A provider without an end-session address: forget the tokens here.
		await u.removeUser();
		location.assign('/');
	}
}
