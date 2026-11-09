# Taska architecture

Taska has one Python server and one React frontend. The server owns persisted state; the browser renders it and
queues changes for reliable delivery. Shared rules are enforced by the architecture checks.

## Shape

```
taska/
  server/taska/        the backend: a Python package, standard library only at run time
  web/                 the page: React + TypeScript + Vite + Tailwind, its Storybook and its tests
  tests/               backend and persisted-data regression tests
  tools/               development, packaging, deployment and service tools
```

What an item's status means and who moves it: [item-states.md](item-states.md).
What happens to what the user says, from Inputs to the items it lands on: [inputs.md](inputs.md).

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

Rules, checked by `tests/test_architecture.py`:

1. A module imports only from its own layer or the layers listed for it above (the composition root excepted).
   `domain`, `commands` and `agent_text` do no I/O (no `sqlite3`, `socket`, `http`, `threading`, `urllib`,
   `subprocess`, `logging`; `domain` and `agent_text` not even `os`).
2. State is typed: `domain.model` dataclasses for items, messages, inputs, documents, comments, files, voice notes' words (one record per note, `Voice`, read by its file wherever the note is); events are
   `domain.events` dataclasses, one per kind (a module per area: items, inputs, documents, voice notes), each kind's stored row
   written by its `to_row` and read by its reader next to it. Plain dicts appear only at the edges: the stored JSON,
   the HTTP JSON bodies.
3. Every change goes through a command handler, which returns events; only `Project.emit` commits them
   (`store.commit`: the log first, then the projection), and only the store writes the file's log and state rows.
4. The projection (`domain.projection`) is one small reducer per event kind, registered in a table (a module per
   area); replaying the log is `for event in log: apply(state, event)`.
5. Reads are pure functions of the state (`domain.rules`, `domain.history`, `agent_text.render`, `page_api.views`).
6. No module over 600 lines (the two generated word lists of the guide excepted).

Each project stores its event log, projected state and agent metadata in SQLite, with attachments in
`taska-files/`. Changes must preserve existing user data and replay the event log consistently. A log of an earlier format is
rewritten once when Taska starts (`services.migrate`, the rewrite itself pure in `domain.migration`): each change in its
place, in today's kinds, from a copy of the file made beside it first, and only when it leaves the same records; no
reader of an earlier format is kept.

## Page: structure

```
web/src/
  app/          composition root (createApp: only assembling; app/core.ts makes the stores and the parts every
                area uses, and each area's services are made by its own factory, app/<area>/area.ts), the hooks
                containers share (the route, a project's model, the projects listed, search hints), the table of
                actions, page-wide behaviours (keys, tooltip, panes), and the services more than one feature uses,
                by area: page/ (navigation, sheets, toasts, fields, media), project/ (the project open, its sync,
                the projects, notices, settings), items/, inputs/ (the box, sending, drafts), docs/, voice/
  api/          typed HTTP calls (time limits, retry, the key)                 no React
  sync/         a project's change stream (the long poll and its pauses), the IndexedDB copy   no React
  model/        pure: types, selectors (sections, needs you, counts, order), words, times              no React
  stores/       Zustand stores, one per concern: server data, pending changes (outbox), drafts, UI, toasts
  ui/           presentational parts more than one feature shows: primitives (buttons, icons, sheets, segments),
                Markdown, files, pickers, the projects' sheets, log lines, search hints, the pane's frame
  features/     one folder per area (sidebar, list, item, composer, inputs, docs, settings, side, find, home, ...):
                presentational components (props only), their containers (hooks into stores) and the services
                only that feature uses (features/list/views.ts, ...); a feature is a leaf: it imports no other
                feature and no page
  pages/        puts features together: the page's root (App.tsx), the project page (its layout, header, the
                detail pane) and the sheets; a feature shown inside another is given as a prop (a slot)
```

Rules, checked by `web/eslint.config.js` (imports, page lookups) and `web/scripts/check-architecture.mjs` (the rest;
`--self` plants one break of each rule in a copy and fails unless every one is caught):

1. Presentational components get everything through props; they import nothing from `app/`, `stores/`, `api/`,
   `sync/`. Features are leaves: a feature imports no other feature and no page; what features share is in `app/`
   (services, hooks), `model/` (selectors) or `ui/` (parts), and `pages/` puts them together. `app/`, `ui/`,
   `model/`, `stores/`, `api/` and `sync/` know no feature and no page (only `app/createApp.ts`, the composition root,
   makes the services a feature keeps for itself). A container (`*Container.tsx`) reads stores and passes props; it names the parts of the app it uses
   (`useServices('nav', 'sheets')`, `useStores('ui')`) and can reach nothing else (`useApp` is the page's root's
   only); an action of the table runs through `app.actions.run(id)` (`app/actions.ts`: each action names the
   services it uses and is given only those).
2. The model (`model/`) is pure: no React, no stores, no `window`/`document`/`fetch`. Stores, `api/` and `sync/`
   are plain TypeScript (no React). Stores change only through their own actions; no state is kept in a module
   (stores are made per app by `createApp`; a WeakMap memo of a pure function is not state).
3. No `document.querySelector`/`getElementById` (refs only; `main.tsx` mounts the page). Listeners for the whole
   page, for as long as it is open (the keys, the tooltip for anything with a title, the pressed look of buttons,
   which pane you acted in), are set in `app/` only. A component may listen on the document or the window for what
   it shows, while it is shown (a menu's click outside it, a document's selected words, a row's swipe), and stops
   when it goes. (`features/docs/pageHelper.ts` runs inside a web page's frame, not in Taska's page.) Elements the
   app measures are given by ref (`app/panes.tsx` for the panes, `features/list/rowSizes.ts` for the list's rows).
4. Layout is an attribute, not the window: `data-layout="desk"|"phone"` on the page's frame (and on a story's
   frame) chooses the layout; `lg:` means the desktop layout and `phone:` the phone's (`src/index.css`), and the
   widths within a layout are container queries on the frame (`wide:`, `huge:`, `roomy:`, `wide-phone:`). So any
   component renders alone at 393 or 1440, side by side.
5. Dark mode follows the system; `data-theme` on any ancestor forces one (Storybook sets it on `<html>` from its toolbar, one theme at a time, R598).
6. Styling: Tailwind utility classes only; the one CSS file imports Tailwind and declares the variants; no raw
   colours, no `<style>`.
7. Every presentational component has a story file next to it: its states side by side, drawn from props (static).
   Demos (`Demo/`, T589) are the only stories that play (`play`, Play): each runs the real page in a frame of its
   own (`stories/demo/DemoPage.tsx`, the one place a story loads the app) whose network is a replay of a real
   server's recorded answers, every other way out closed; a Demo covers no component. Every exported
   component under `ui/` and `features/` is drawn by some story, directly or through what the story renders (read
   from the source by `web/scripts/story-coverage.mjs`); a container (`*Container`, or in `app/`) is covered when
   everything it renders is. The few that need no story are listed with a reason in `web/.storybook/no-story.txt`.
8. Rendering is pure: no ref read or written while drawing, no `Date.now()` (a project's times are told against
   `ProjectModel.at`, when its data last came or you last changed something).

Every check at once: `npm run check` in `web/` (types, lint, the architecture check with its self-check,
frontend unit tests and backend regression tests). `tools/e2e.py --all` runs browser journeys on isolated
servers; `tests/check_data.py` validates a copied data root without a second implementation.

## Data flow on the page

- The server is the truth. A project's view model arrives whole once, then as changes (a cursor) over a long poll;
  a tab in the background asks less often and lets go (many tabs must not fill the browser's connections).
- A change you make is a command in the outbox store: shown at once as an overlay on the server data (a pure
  function of server data + pending commands), sent in order with an id (the server runs it once), kept in
  localStorage until the server has it, sent again when the server is back. What it shows is its preview
  (`model/optimistic.ts`: one per command, as the server's handler will make it, held to the server's own cases);
  a sender only says the command (`runner.change(slug, command, said)`), never what it shows.
- Whatever has to reach the server (a change, an input, a file or a voice note going up and its words, a move, a
  search, a setting) goes through one `Delivery` (`api/delivery.ts`): asked again with growing pauses until the
  server answers, never given up, every pause ended at once when the server may be back (it answered, the network
  returned, the window shows again); only a refusal, or what it was for being gone, ends it.
- Whether the server is out of reach is one rule, `model/reach.ts` (T728 #8): every place counts its tries without an
  answer the same way (one that timed out counts twice), says so from the same threshold and in the same words.
- Derived things (sections of the list, counts, needs you, the agents' next item) are selectors over that overlay,
  computed with the same rules as the server's: the page's copies are held to cases the server's own code ran
  (`model/ruleCases.gen.ts`), and its words (types, statuses, priorities, kinds) are the server's
  (`model/vocab.gen.ts`), both written by `tools/rule_cases.py`.
