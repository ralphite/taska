# Taska (app/): architecture

The rewrite of Taska (F581). The goals are in Taska D89, the acceptance in D90, the list of things that must not
change in D94. `v2/` is the running version and the behaviour reference only: nothing here imports, copies or ports
its code or its structure. Product specs are kept as specs: the words agents read, copy, icons, colours, sizes, the
stored formats.

## Shape

```
app/
  server/taska/        the backend: a Python package, standard library only at run time
  web/                 the page: React + TypeScript + Vite + Tailwind, its Storybook and its tests
  tests/               backend tests, and the differential checks against the old version
  tools/               data copy, checks
```

## Backend: layers and the direction of their imports

```
http        routes -> handlers; requests and answers; access rules     (knows page_api, agent_text, services, infra, domain)
page_api    the page's JSON: view models, change sync, answers kept by id (knows services, agent_text, domain)
services    a project put together from its parts, the workspace of
            projects, the organizer, voice, push, moves between projects (knows agent_text, commands, infra, domain)
agent_text  the agent interface's words, pure: the command language read
            into commands, the state written as text, the guide          (knows domain)
commands    one handler per change: checks it, then emits events         (knows domain)
infra       SQLite file, files, Gemini, web push crypto, logging         (knows domain)
domain      pure: typed records, events, the projection, the rules       (knows nothing above it)
```

`cli.py` is the composition root: it makes the workspace, the organizers, the push loop and the server, and wires
them. The agent interface is `http.agent_routes` (its routes) over `agent_text` (its words); the organizer uses the
same words, as an agent does.

A project at run time (`services.project.Project`) is put together from parts that each do one thing, under one
lock: `store` (the log in the file, the state replayed from it, the state rows kept in step), `files`, `news` (the
number that says there is news, and the waiting for it: pages, agents, voice jobs), `agents` (who is around, what
they read), `voice` (notes being worked out), `organizing` (what the organizer does now). `Project` itself only
hands each question to its part and implements what command handlers ask (`commands.base.Changes`). Moves between
projects (`services.moves.Moves`) belong to the workspace; the page's answers kept by id (`page_api.once`) to the
page side.

Rules, checked by `app/tests/test_architecture.py`:

1. A module imports only from its own layer or the layers listed for it above (the composition root excepted).
   `domain`, `commands` and `agent_text` do no I/O (no `sqlite3`, `socket`, `http`, `threading`, `urllib`,
   `subprocess`, `logging`; `domain` and `agent_text` not even `os`).
2. State is typed: `domain.model` dataclasses for items, messages, inputs, documents, comments, files; events are
   `domain.events` dataclasses, one per kind (a module per area: items, inputs, documents), each kind's stored row
   written by its `to_row` and read by its reader next to it. Plain dicts appear only at the edges: the stored JSON,
   the HTTP JSON bodies.
3. Every change goes through a command handler, which returns events; only `Project.emit` commits them
   (`store.commit`: the log first, then the projection), and only the store writes the file's log and state rows.
4. The projection (`domain.projection`) is one small reducer per event kind, registered in a table (a module per
   area); replaying the log is `for event in log: apply(state, event)`.
5. Reads are pure functions of the state (`domain.rules`, `domain.history`, `agent_text.render`, `page_api.views`).
6. No module over 600 lines (the two generated word lists of the guide excepted).
7. Nothing names the old version (`v2/`, `taska.py`); with `TASKA_OLD_SRC` set, no file is a copy of one of its
   files.

The stored formats are fixed (D94): the `events` table rows, the state tables, `kv` (agents, reads, heard), the data
root files, `taska-files/fN-name`. The old version must run on data this version wrote (roll back).

## Page: structure

```
web/src/
  app/          composition root: creates the stores and services, provides them; page-wide behaviours
  api/          typed HTTP calls (time limits, retry, the key)                 no React
  sync/         a project's change stream (the long poll and its pauses), the IndexedDB copy   no React
  model/        pure: types, selectors (sections, needs you, counts, order), words, times              no React
  stores/       Zustand stores, one per concern: server data, pending changes (outbox), drafts, UI, toasts
  ui/           presentational primitives (buttons, icons, pills, menus, toasts)
  features/     one folder per area (sidebar, list, item, composer, inputs, docs, settings, home):
                presentational components (props only) and their containers (hooks into stores)
```

Rules, checked by `web/eslint.config.js` (imports, page lookups) and `web/scripts/check-architecture.mjs` (the rest;
`--self` plants one break of each rule in a copy and fails unless every one is caught):

1. Presentational components get everything through props; they import nothing from `app/`, `stores/`, `api/`,
   `sync/`. A container (`*Container.tsx`) reads stores and passes props; it names the parts of the app it uses
   (`useServices('nav', 'sheets')`, `useStores('ui')`) and can reach nothing else (`useApp` is the page's root's
   only); an action of the table runs through `app.actions.run(id)` (`app/actions.ts`: each action names the
   services it uses and is given only those).
2. The model (`model/`) is pure: no React, no stores, no `window`/`document`/`fetch`. Stores, `api/` and `sync/`
   are plain TypeScript (no React). Stores change only through their own actions; no state is kept in a module
   (stores are made per app by `createApp`; a WeakMap memo of a pure function is not state).
3. No `document.querySelector`/`getElementById` (refs only; `main.tsx` mounts the page). Page-wide behaviours
   that apply to every element (the tooltip for anything with a title, the pressed look of buttons, which pane you
   acted in) listen on the document, in `app/` only. Elements the app measures are given by ref (`app/panes.tsx`
   for the panes, `app/rowSizes.ts` for the list's rows).
4. Layout is an attribute, not the window: `data-layout="desk"|"phone"` on the page's frame (and on a story's
   frame) chooses the layout; `lg:` means the desktop layout and `phone:` the phone's (`src/index.css`), and the
   widths within a layout are container queries on the frame (`wide:`, `huge:`, `roomy:`, `wide-phone:`). So any
   component renders alone at 393 or 1440, side by side.
5. Dark mode follows the system; `data-theme` on any ancestor forces one (Storybook frames use it).
6. Styling: Tailwind utility classes only; the one CSS file imports Tailwind and declares the variants; no raw
   colours, no `<style>`.
7. Every presentational component has a story file next to it: its states side by side, drawn from props (static);
   demos (played) are under `Demos/` and are the only stories with `play`; no story loads the app.
8. Rendering is pure: no ref read or written while drawing, no `Date.now()` (a project's times are told against
   `ProjectModel.at`, when its data last came or you last changed something).

Every check at once: `npm run check` in `app/web` (types, lint, the architecture check with its self-check, the
page's unit tests, the backend's types and its architecture test). The differential checks against the running old
version are in `app/tests/differential/` (they need both servers on copies of the data).

## Data flow on the page

- The server is the truth. A project's view model arrives whole once, then as changes (a cursor) over a long poll;
  a tab in the background asks less often and lets go (the old page's policy, kept: many tabs must not fill the
  browser's connections).
- A change you make is a command in the outbox store: shown at once as an overlay on the server data (a pure
  function of server data + pending commands), sent in order with an id (the server runs it once), kept in
  localStorage until the server has it, sent again when the server is back.
- Derived things (sections of the list, counts, needs you) are selectors over that overlay, computed with the same
  rules as the server's.
