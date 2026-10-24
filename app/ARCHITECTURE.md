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
http        routes -> handlers; requests and answers; access rules            (knows services, agent_api, page_api)
agent_api   the plain-text interface: command language, answers, the guide    (knows services, domain)
page_api    the page's JSON: view models, change sync                         (knows services, domain)
services    a project (state + log + lock + change feed), the workspace of
            projects, the organizer, voice, push, moves between projects     (knows domain, commands, infra)
commands    one handler per change: checks it, then emits events              (knows domain)
domain      pure: typed records, events, the projection, the rules           (knows nothing above it)
infra       SQLite log, files, Gemini, web push crypto, logging               (knows nothing above it)
```

Rules (each has a check in `app/tests/test_architecture.py`):

1. A module imports only from its own layer or the layers listed under it above. `domain` imports no I/O
   (`sqlite3`, `socket`, `http`, `threading`, `urllib`, `os` file access).
2. State is typed: `domain.model` dataclasses for items, messages, inputs, documents, comments, files; events are
   `domain.events` dataclasses, one per kind, converted to and from the stored JSON in one place (`codec`).
   Plain dicts appear only at the edges: the stored JSON, the HTTP JSON bodies.
3. Every change goes through a command handler, which returns events; only `services.project.Project.commit`
   writes them (log first, then the projection). Nothing else mutates the state.
4. The projection (`domain.projector`) is one small reducer per event kind, registered in a table; replaying the log
   is `for event in log: apply(state, event)`.
5. Reads are pure functions of the state (`domain.rules`, `domain.history`, `agent_api.render`, `page_api.views`).
6. No module over 600 lines, no class with more than one job.
7. Nothing from `v2/` is imported or copied (a check compares the files).

The stored formats are fixed (D94): the `events` table rows, the state tables, `kv` (agents, reads, heard), the data
root files, `taska-files/fN-name`. The old version must run on data this version wrote (roll back).

## Page: structure

```
web/src/
  app/          composition root: creates the services, provides them, the router outlet
  api/          typed HTTP calls (time limits, retry, the key)                 no React
  sync/         one change stream per browser (a leader tab, BroadcastChannel), the IndexedDB copy   no React
  model/        pure: types, selectors (sections, needs you, counts, order), words, times              no React
  stores/       Zustand stores, one per concern: server data, pending changes (outbox), drafts, UI, toasts
  ui/           presentational primitives (buttons, icons, pills, menus, toasts)
  features/     one folder per area (sidebar, list, item, composer, inputs, docs, settings, home):
                presentational components (props only) and their containers (hooks into stores)
```

Rules (checked by ESLint config and `web/scripts/check-architecture.mjs`):

1. Presentational components get everything through props; they import no store, no `api`, no `sync`. A container
   (`*Container.tsx` or a `use*` hook in the feature) reads stores and passes props.
2. Stores change only through their own actions; components never mutate data. No module-level mutable objects
   outside stores.
3. No global click dispatch, no `document.getElementById`/`querySelector` for app logic (refs only); events are
   handled where the element is.
4. Layout responds to the component's container (Tailwind container queries) and a `LayoutMode` from context, never
   to `window` directly, so any component renders alone at 393 or 1440 side by side.
5. Dark mode follows the system; `data-theme` on any ancestor forces one (Storybook frames use it).
6. Styling: Tailwind utility classes only; the one CSS file imports Tailwind and declares the theme and variants.
7. Every presentational component has a story file next to it: its states side by side (static); demos (played)
   are separate and the only stories with `play`.

## Data flow on the page

- The server is the truth. A project's view model arrives whole once, then as changes (a cursor) over one long poll
  per browser; the leader tab holds it and shares with the others.
- A change you make is a command in the outbox store: shown at once as an overlay on the server data (a pure
  function of server data + pending commands), sent in order with an id (the server runs it once), kept in
  localStorage until the server has it, sent again when the server is back.
- Derived things (sections of the list, counts, needs you) are selectors over that overlay, computed with the same
  rules as the server's.
