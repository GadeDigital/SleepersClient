# glyph-client

This is **glyph-client**, one of two repositories for Sleepers. It contains the web client: a Svelte 5 + PixiJS app built with Vite, running in the player's browser.

Sleepers is a multiplayer, chat-driven space game in 2D pixel art. Players crew ships, talk in character, explore procedurally generated planets and build bases. The world is tile-based (1 tile is about 1 m).

## The two repositories

Both sit side by side in a parent folder, which is opened in VSCodium:

```
glyph/
  glyph-server/   the Go game server, proto/ schema and docs/ (separate repository)
  glyph-client/   THIS repository: Svelte 5 + PixiJS web client
```

- **Work only in this repository** unless the task is tagged **[server]**. Tasks in the plan are tagged **[server]**, **[client]** or **[local]**.
- You may read `../glyph-server/` to understand the server and the messages, but do not edit it from a **[client]** task, with one exception: the docs in `../glyph-server/docs/` (see "Keeping the docs up to date").
- The client talks to the server only over a WebSocket, using messages defined in `../glyph-server/proto/`.

## Read these first

The docs live in the server repository:

- `../glyph-server/docs/architecture.md`: the architecture, including the Repositories section and the ADR log (numbered decisions). It is the source of truth for design.
- `../glyph-server/docs/plan.md`: milestones M0 to M9, each broken into tagged tasks with a "done when" check.

Before starting a task, find it in the plan and read the ADRs it references.

## What lives here

```
src/                Svelte 5 components and client code
src/lib/proto/      TypeScript GENERATED from ../glyph-server/proto (committed, never edited by hand)
```

## Rules that must not be broken

- **No game logic in the client** (ADR 002). The server decides everything: movement, speech ranges, what anyone can see or hear. The client renders what the server sends and sends player commands.
- **Never hand-write a message type.** All message types come from `src/lib/proto/`, generated from `../glyph-server/proto/` with `npm run proto`. If a message is missing or wrong, the fix starts in glyph-server as a **[server]** task.
- **Svelte 5 with runes** (`$state`, `$derived`, `$effect`) for UI and reactive state.
- **PixiJS draws the world view**, hosted in one Svelte component. Chat, inventory and menus are Svelte.
- **Pixel-art rendering**: nearest-neighbour scaling, whole-number zoom levels only.
- **Visual smoothing is allowed, rule changes are not.** Gliding a sprite between tiles over a step's duration is fine; predicting or deciding outcomes is not.

## How we work

- Work in small, testable steps. Say how to verify each one when done (usually: which windows to open and what you should see).
- If a task needs a design decision that the docs don't cover, stop and ask.
- If the client needs something the server doesn't provide yet, stop and say which **[server]** task is missing.
- Keep dependencies few and well known. Ask before adding a new one.

## Keeping the docs up to date

`../glyph-server/docs/architecture.md` and `../glyph-server/docs/plan.md` are the master copies, and keeping them current is part of every task:

- Tick the task in `plan.md` and update its milestone's status. A milestone is Done only when its "done when" check passes.
- Record any design decision as a new ADR in `architecture.md`, with a changelog row (bump the version). Never edit an accepted ADR; supersede it with a new one.
- These doc edits are the only changes a **[client]** task may make in glyph-server. Commit them in glyph-server, separately from the glyph-client commit.

## Tools

- **Svelte MCP**: for any Svelte or SvelteKit question, look up the current docs with `list-sections` and `get-documentation` rather than relying on memory. Run `svelte-autofixer` on every Svelte component you write or change, and repeat until it reports no issues. Never use `playground-link`, since our code lives in files.

## Environment

Arch Linux, VSCodium with the Claude Code extension. Toolchain: Node.js, npm, the Protocol Buffers compiler, git.
