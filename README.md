# glyph-client

The web client for Project Glyph: a Svelte 5 + PixiJS single-page app built with Vite (SvelteKit with SSR off and `adapter-static`).

The server, message schema and design docs live in the sibling repository `../glyph-server/`. See `CLAUDE.md` and `../glyph-server/docs/` for the architecture and plan.

## Developing

```sh
npm install
npm run dev      # dev server at http://localhost:5173
npm run proto    # regenerate src/lib/proto/ from ../glyph-server/proto/ (needs protoc)
```

## Checks

```sh
npm run build    # static build into build/, with index.html as the SPA fallback
npm run check    # svelte-check (types)
npm run lint     # prettier + eslint
npm run test     # vitest (unit + browser component tests)
```

Preview the production build with `npm run preview`.
