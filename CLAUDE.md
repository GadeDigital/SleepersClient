# sleepers-client

This is **sleepers-client**, one of two repositories for Sleepers. It contains the web client: a Svelte 5 + three.js app built with Vite, running in the player's browser.

Sleepers is a multiplayer, chat-driven space game shown as 3D scenes with a pixel-art look. Players crew ships, talk in character, explore procedurally generated planets and build bases. The world is tile-based (1 tile is about 1 m).

## The two repositories

Both sit side by side in a parent folder, which is opened in VSCodium:

```
Sleepers/
  sleepers-server/   the Go game server, proto/ schema and docs/ (separate repository)
  sleepers-client/   THIS repository: Svelte 5 + three.js web client
```

- **Work only in this repository** unless the task is tagged **[server]**. Tasks in the plan are tagged **[server]**, **[client]** or **[local]**.
- You may read `../sleepers-server/` to understand the server and the messages, but do not edit it from a **[client]** task, with one exception: the docs in `../sleepers-server/docs/` (see "Keeping the docs up to date").
- The client talks to the server only over a WebSocket, using messages defined in `../sleepers-server/proto/`.

## Read these first

The docs live in the server repository:

- `../sleepers-server/docs/architecture.md`: the architecture, including the Repositories section and the ADR log (numbered decisions). It is the source of truth for design.
- `../sleepers-server/docs/plan.md`: milestones M0 to M9, each broken into tagged tasks with a "done when" check.
- `../sleepers-server/docs/game-design.md`: what Sleepers is to play, including the views and the zoom ladder.

Before starting a task, find it in the plan and read the ADRs it references.

## What lives here

```
src/                Svelte 5 components and client code
src/lib/render/     three.js: the engine, pixel sizes, labels, views (ADR 051)
src/lib/render/views/mock/  the zoom-ladder mockup's mock data and views (/mockup)
src/lib/proto/      TypeScript GENERATED from ../sleepers-server/proto (committed, never edited by hand)
static/fonts/       the mockup's fonts, self-hosted, with their licences
```

## Rules that must not be broken

- **No game logic in the client** (ADR 002). The server decides everything: movement, speech ranges, what anyone can see or hear. The client renders what the server sends and sends player commands.
- **Never hand-write a message type.** All message types come from `src/lib/proto/`, generated from `../sleepers-server/proto/` with `npm run proto`. If a message is missing or wrong, the fix starts in sleepers-server as a **[server]** task.
- **Svelte 5 with runes** (`$state`, `$derived`, `$effect`) for UI and reactive state.
- **three.js draws the world**, hosted in one Svelte component (`WorldView`, through `EngineHost`); scenes and cameras live in plain TypeScript view classes, never in Svelte state (ADR 051). Chat, inventory and menus are Svelte.
- **Pixel-art look**: render at low resolution and scale up with nearest-neighbour; one art pixel is a whole number of physical pixels (ADR 051). The camera and labels snap to the art-pixel grid (ADR 066).
- **Text over the world** (names, speech, labels) is HTML over the canvas, never drawn in 3D.
- **Gameplay is a 2D tile grid**; height is visual only (ADR 052). Movement keys are relative to the screen (ADR 057).
- **The `/mockup` route and everything under `src/lib/render/views/mock/` is mock data for design**: never feed it game state, and never move its client-side rules (walking, the nav-station lock) into the game.
- **Visual smoothing is allowed, rule changes are not.** Gliding a sprite between tiles over a step's duration is fine; predicting or deciding outcomes is not.

## How we work

- Work in small, testable steps. Say how to verify each one when done (usually: which windows to open and what you should see).
- If a task needs a design decision that the docs don't cover, stop and ask.
- If the client needs something the server doesn't provide yet, stop and say which **[server]** task is missing.
- Keep dependencies few and well known. Ask before adding a new one.

## Keeping the docs up to date

`../sleepers-server/docs/architecture.md` and `../sleepers-server/docs/plan.md` are the master copies, and keeping them current is part of every task:

- Tick the task in `plan.md` and update its milestone's status. A milestone is Done only when its "done when" check passes.
- Record any design decision as a new ADR in `architecture.md`, with a changelog row (bump the version). Never edit an accepted ADR; supersede it with a new one.
- These doc edits are the only changes a **[client]** task may make in sleepers-server. Commit them in sleepers-server, separately from the sleepers-client commit.

## Tools

- **Svelte MCP**: for any Svelte or SvelteKit question, look up the current docs with `list-sections` and `get-documentation` rather than relying on memory. Run `svelte-autofixer` on every Svelte component you write or change, and repeat until it reports no issues. Never use `playground-link`, since our code lives in files.

## Environment

Arch Linux, VSCodium with the Claude Code extension. Toolchain: Node.js, npm, the Protocol Buffers compiler, git.
