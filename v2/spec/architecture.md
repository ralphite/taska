# Taska v2: architecture

English copy of the approved technical plans: D15 (frontend stack), D16 (frontend plan), D17 (agent-dev practices),
D18 (full rewrite plan), D19 (backend stack). The product requirements are in [product-spec.md](product-spec.md).

## Goal

A full rewrite of Taska (frontend, backend, storage) in `v2/`, with the same layout, UI and features as the one-file
Taska, only better: bugs fixed, small design improvements, nothing dropped, nothing done a different way without the
user's say. The old app (`taska.py`, port 7340, data in `~/.taska`) keeps working unchanged until the user switches.

## Layout

| Path | What |
|---|---|
| `v2/server/taska/` | the backend, a Python package (standard library only) |
| `v2/web/` | the frontend (React), its Storybook and its tests |
| `v2/tests/` | backend tests: behaviour captured from the old app (golden files) and the import check |
| `v2/tools/` | build tools (the single-file `taska.pyz`) |
| `v2/spec/` | these documents |

## Backend (D19)

- **Python 3.9+, standard library only** at runtime. `http.server` (threaded), `sqlite3`, `json`, `urllib`.
- **Full type hints**; `pyright` in strict mode is a development check only (`npm run typecheck:server` in `v2/web`).
- Modules:

| Module | Job |
|---|---|
| `core.py` | item types, statuses, times, Markdown blocks, small helpers |
| `storage.py` | SQLite: the change log, the current state, small values |
| `store.py` | one project: replay of the log into state, lookups, voice jobs |
| `ops.py` | every change, checked, then written as an event |
| `views.py` | the plain-text answers for agents, and the page's JSON state |
| `dsl.py` | the command language of `/do` |
| `guide.py` | the agent guide, the grammar, the skill, the connect script (word for word as before) |
| `organizer.py`, `gemini.py`, `voice.py` | the Gemini organizer and voice transcription |
| `push.py` | Web Push to phones (VAPID, P-256 in pure Python) |
| `hub.py` | all projects, and what they share (key, spellings, order) |
| `web.py` | the HTTP server: agent API, page API, files, the page |
| `assets.py` | the built page's files (from the package, or `v2/web/dist` in development) |
| `importer.py` | the migration from `taska.jsonl` to `taska.db` |
| `cli.py` | `python3 -m taska` / `python3 taska.pyz` |

### Storage

One SQLite file per project, `<root>/<project>/taska.db`:

- `events`: the **append-only change log** (one row per change, never changed). Undo, history, Activity and
  tracing a change back to the input all read it. It is written before the change is applied, so a change that
  happened is never lost.
- `items`, `inputs`, `docs`: the **current state**, kept in step with the log (within a second), so the data can be
  read without Taska. Taska itself replays the log when it opens a project (milliseconds for thousands of changes).
- `kv`: values that change often and are not history (when an agent was last seen, what it read).

Attachments and voice notes stay plain files in `<root>/<project>/taska-files/`. Settings shared by all projects stay
small files in the data root (`key`, `corrections.json`, `voice-prefs.txt`, `project-order.json`, `.push/`).

### Migration

`python3 -m taska import --from ~/.taska --to <folder>` makes a copy for the trial (the old data is only read).
Every old log line becomes one event with the same number, so the state, the item codes and every agent-facing
answer are the same; `v2/tests/check_import.py` proves it against the old app on real data. On switch day,
`--in-place` writes `taska.db` next to each `taska.jsonl` and leaves the old files as they are. v2 refuses to start
on a data folder that still holds un-imported old projects, so it can never write into the old data by mistake.

### Agent interface

`/agent`, `/next`, `/do`, `/items`, `/B03`, `/D1`, `/r12`, `/log`, `/rules`, `/inbox`, `/connect`, `/skill`,
`/api/file` stay **100% compatible**: same paths, same parameters, same words. `v2/tests/scenarios.py` runs the same
requests against the old app (recorded once into `v2/tests/golden/`) and against v2 (`v2/tests/test_compat.py`).

## Frontend (D15, D16, D17)

- **React 19 + TypeScript (strict) + Vite**, **Tailwind CSS v4** (`@tailwindcss/vite`, built at build time, no
  runtime compiler), **Zustand** (UI state, drafts, outbox), **lucide-react** icons, **markdown-it + DOMPurify**,
  **vite-plugin-pwa** (installable, push, the page shell cached). Server data, addresses (`/p/<project>/B03`,
  `/inputs`, `/settings` ...) and dialogs are Taska's own code (`src/lib`, `src/components`).
- **Styling: Tailwind utilities only**; no hand-written CSS (the only CSS file imports Tailwind and declares the
  dark variant).
- **Storybook** (with its MCP addon) for every component, phone 393x852 and desktop 1440x900, light and dark;
  **Vitest + Testing Library** for logic and components; **Playwright** for end-to-end runs against a real server on a
  data copy; **ESLint + Prettier + prettier-plugin-tailwindcss**.
- Node is needed only to develop and to build. The build output is served by the Python server; the release packs
  it into `taska.pyz`.

## Release

A GitHub Actions workflow builds the frontend, runs the checks, and packs the Python package and the built page into
one file, `taska.pyz` (`python3 -m zipapp`). `python3 taska.pyz` runs everything; no Node at runtime.

## Steps (F295 and its subitems)

1. English spec and scaffold.
2. Behaviour capture on the old app (agent API and key UI flows) on a data copy: the acceptance tests.
3. Backend, SQLite and the import tool.
4. Frontend data layer, shell and list.
5. Item page, input box, voice.
6. Documents and Inputs.
7. The rest: Settings, Activity, Deleted, Documents, Cmd+K, shortcuts, home page.
8. Side-by-side comparison at 393 and 1440; every difference fixed.
9. Release workflow and `taska.pyz`.
