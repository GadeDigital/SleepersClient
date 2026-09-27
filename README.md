# sleepers-client

The web client for Sleepers: a Svelte 5 + PixiJS single-page app built with Vite (SvelteKit with SSR off and `adapter-static`).

The server, message schema and design docs live in the sibling repository `../sleepers-server/`. See `CLAUDE.md` and `../sleepers-server/docs/` for the architecture and plan.

## Developing

```sh
npm install
npm run dev      # dev server at http://127.0.0.1:5173
npm run proto    # regenerate src/lib/proto/ from ../sleepers-server/proto/ (needs protoc)
```

## Settings

Copy `.env.example` to `.env` (gitignored, never commit it) and fill it in: the identity provider's authority, client id and audience for signing in (ADR 042), the account service's address, and `VITE_DEV_LOGIN=1` to show the development login. Restart `npm run dev` after changing it.

## Playing locally

Run the server with `make dev` in `../sleepers-server` (it accepts pages from `127.0.0.1:5173` and `localhost:5173`), then `npm run dev` here and open http://127.0.0.1:5173 in two windows. Move with WASD or the arrow keys (two held make a diagonal; Q/E/Z/C are diagonals too). L lies down to sleep on a bed (that is how you log out: close the game asleep and you wake there); moving gets you up. G digs, B builds a wall and X takes one down: press the key, hold a direction to aim at the tile next to you, and let go (Esc cancels). Set `VITE_SERVER_URL` to use a server other than `ws://<this host>:8080/ws`.

## Checks

```sh
npm run build    # static build into build/, with index.html as the SPA fallback
npm run check    # svelte-check (types)
npm run lint     # prettier + eslint
npm run test     # vitest (unit + browser component tests)
```

Preview the production build with `npm run preview`.
