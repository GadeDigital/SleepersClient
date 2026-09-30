# sleepers-client

The web client for Sleepers: a Svelte 5 + three.js single-page app built with Vite (SvelteKit with SSR off and `adapter-static`). The world is drawn as low-poly 3D scenes with a pixel-art look (ADR 051).

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

Run the server with `make dev` in `../sleepers-server` (it accepts pages from `127.0.0.1:5173` and `localhost:5173`), then `npm run dev` here and open http://127.0.0.1:5173 in two windows. Move with WASD or the arrow keys, relative to the screen: up walks up the screen, and two held make a diagonal. Q and E turn the camera 90°. L lies down to sleep on a bed (that is how you log out: close the game asleep and you wake there); moving gets you up. B builds a wall and X takes one down: press the key, hold a direction to aim at the tile next to you, and let go (Esc cancels). The pixel size (Off, 2×, 3×, 4×) is in the card at the top left. F2 opens the development tools (planet overview, teleport): DEVELOPMENT ONLY, for accounts with the admin role on a server run with `-dev-tools` (ADR 067). Development-login accounts are admins; an Auth0 account gets the role in the database (`UPDATE accounts SET role = 'admin' ...`). Until the server tells the client whether the tools are on, F2 still opens the panel elsewhere, and the server refuses its requests.

In development builds, http://127.0.0.1:5173/mockup shows the zoom-ladder mockup on mock data (ADR 053). Set `VITE_SERVER_URL` to use a server other than `ws://<this host>:8080/ws`.

## Checks

```sh
npm run build    # static build into build/, with index.html as the SPA fallback
npm run check    # svelte-check (types)
npm run lint     # prettier + eslint
npm run test     # vitest (unit + browser component tests)
```

Preview the production build with `npm run preview`.
