# Development

## Project layout

| Directory | Responsibility |
| --- | --- |
| `server/taska/` | Python server, domain rules, persistence, agent interface and HTTP API |
| `web/` | React frontend, Storybook, unit tests and browser journeys |
| `tests/` | Server regression tests, architecture rules and persisted-data checks |
| `tools/` | Development, packaging, deployment, data-copy and operations commands |
| `tools/launchd/` | Templates for the existing macOS services |
| `docs/` | Architecture, development and product screenshots |

There is one implementation of Taska. See [architecture.md](architecture.md) for the layer boundaries.

## Local development

Run commands from the repository root. Python 3.9 or later runs the server without third-party packages; Node.js 26
builds and tests the frontend. Use `nvm install` once, then `nvm use` to select the version in `.nvmrc` before running
npm commands. The development test suite uses Python 3.11 or later (`tomllib`); CI separately builds and
starts the release on Python 3.9 to verify the runtime minimum.

```sh
npm ci --prefix web
npm --prefix web run build
PYTHONPATH=server python3 -m taska --port 7341 --root /tmp/taska-dev --organizer off
```

Open `http://127.0.0.1:7341`. For frontend hot reload, run `npm --prefix web run dev` and open
`http://127.0.0.1:5341`. `TASKA_API` selects the API target and `TASKA_WEB_PORT` selects the Vite port.

Use a separate data root for development. To reproduce a problem with existing data, take a consistent SQLite
backup rather than copying a live database file:

```sh
python3 tools/copy_data.py ~/.taska /tmp/taska-data-copy
PYTHONPATH=server python3 -m taska --port 7341 --root /tmp/taska-data-copy --organizer off
```

The destination must not already exist. The source data is only read and symbolic links are excluded.

## Checks

| Command | Coverage |
| --- | --- |
| `npm --prefix web run check` | Types, lint, architecture, frontend unit tests and server regression tests |
| `npm --prefix web run build` | Production frontend and service worker |
| `python3 tools/e2e.py --all` | Browser journeys on isolated servers and empty data roots |
| `python3 tools/e2e.py e2e/req/needs.spec.ts` | One browser spec |
| `python3 tests/check_data.py /tmp/taska-data-copy` | Existing data loads and replays consistently |
| `node tools/smoke.mjs http://127.0.0.1:7341 taska --shots /tmp/task-shots` | Desktop and phone smoke check with screenshots |

CI runs the representative core browser journeys in `box.spec.ts`, `counts.spec.ts`, `comments.spec.ts` and
`docedit.spec.ts`. The complete sweep remains available through `python3 tools/e2e.py --all`; its assertions remain
intact. It includes [known product gaps](known-issues.md) found during the cleanup and is not currently all green.
Those existing gaps are recorded separately from the source-layout cleanup, not hidden with skipped assertions.

Install browser binaries once with `cd web && npx playwright install chromium`. Browser checks must respect the
machine's browser budget. Run potentially destructive journeys on copied data; inspect the actual live app after
deployment to verify the service and existing records still work.

`tools/nightly-checks.sh [data root]` checks the latest committed source in an isolated temporary checkout and a
backup of the data (default `~/.taska`). It runs ordinary code, never a model. It reports test failures to Taska. Its launchd job runs at standard
priority: as a background job macOS throttled it enough that the unit tests' workers timed out starting (B660).

### UI audit

`node tools/ui_audit.mjs` builds the static Storybook, opens every story in headless Chromium (one browser, four
pages, about two minutes for 800 stories) and measures visible display problems, with no model:

| Kind | What it measures |
| --- | --- |
| `align` | controls in one row whose vertical centres differ by more than 1.5 px; in a row with text on several lines, a small control set at the top against the text's first line |
| `height` | boxed buttons or chips side by side whose heights differ by 2 to 12 px; in a pill or toolbar, any difference over 2 px |
| `icon` | a control's icon not centred on its one-line label |
| `wrap` | a short label (up to five words) of a button, tab or chip drawn on two lines |
| `midword` | a short word broken across lines (break-words in a box narrower than the word) |
| `cut` | text cut off by its box without an ellipsis, a fade or a scroller |
| `overflow` | a phone frame (393 wide) that scrolls sideways, and the element that sticks out |

Stories draw the phone and the desktop side by side in their frames (`data-layout`), so one pass covers both; a
finding names the layouts it was seen in. Prototype and Review stories are skipped. The rules that keep meant looks
out (story frames, rows aligned to the end, multi-line rows, an icon over its label, ellipses) are in
`tools/ui_audit_probe.mjs` and tested on small pages by `node --test tools/ui_audit.test.mjs`. Findings that are
meant are listed with the reason in `tools/ui_audit_exceptions.json`.

Without `--file` it only prints what it finds; `--only <story id part>` measures some stories, `--out <dir>` keeps
the findings and their cropped pictures. The nightly checks run it with `--file`: each new problem becomes one open
P1 bug in the taska project, by `ui-audit`, with its picture, stories, layouts and source file. A problem's
signature (its check, and the tag and classes of the elements involved) is kept in `.logs/ui-audit/known.json`
once filed, so it is never filed twice; at most ten are filed a night. `--baseline` records what it finds now as
known without filing it.

## Storybook

Storybook runs independently from the Taska server at `http://127.0.0.1:6007`:

```sh
npm --prefix web run storybook
```

On the managed development machine, the existing `com.taska.storybook-app` LaunchAgent owns that port. Reuse it;
do not start a second instance. Static component stories use the product components and props. Storybook is not
bundled into the deployed app.

A Demo (`Demo/` in Storybook, `web/src/stories/demo/`) plays something you do in Taska on the real page, in a phone's
frame and a desktop's, answered by a real server's recorded answers. One list of steps per layout (`demos.ts`)
drives the guided tour, Play, the recording and the check. After a change to what a Demo goes through, record it
again and check it, on a static build (never the running Storybook):

```sh
npm --prefix web run build-storybook
node web/scripts/record-demo.mjs web/dist-storybook [demo] [phone|desk]   # a real Taska on a copy of the demo data
npm --prefix web run build-storybook
node web/scripts/check-demos.mjs web/dist-storybook [--shots dir] [--video dir] [--quick]
```

Recording runs `tools/demo_server.py` on a fresh copy of `web/.storybook/demo-data` and a free port: the real server
with its clock, the voice note's words and the organizer's answer fixed (the Demo's `<demo>.json`); nothing reaches
a model. The check plays each Demo to the end and leaves it alone for half a minute (the page's long wait for news
must be answered as the server answers it, not seen as offline).

The watchdog checks Storybook health without calling a model. It restarts only after five minutes of failure and
logs the reason. After an intentional Storybook configuration change, use
`zsh tools/storybook-restart.sh <agent> <reason>`; otherwise let the watchdog handle failures.

## Package and deploy

```sh
python3 tools/build_pyz.py
python3 tools/check_package.py dist/taska.pyz
python3 dist/taska.pyz --port 7341 --root /tmp/taska-release --organizer off
```

The archive contains the Python package and frontend assets, and runs without Node.js. `--skip-web` packages an
already-built `web/dist`. CI checks every change and publishes the archive for version tags.

On the managed installation, `zsh tools/ship.sh` runs checks, builds the frontend, copies it to `web/live`, then
restarts `com.taska.app` once Taska has been idle for a minute. An active page can request the restart itself.
Development builds in `web/dist` do not replace the deployed assets.

LaunchAgent definitions live in `tools/launchd/`. Render a selected definition for the current checkout with:

```sh
python3 tools/install_launchd.py --label com.taska.app
```

This only writes the plist; it never starts, stops or restarts a service. Labels stay stable so existing services
can be updated without creating duplicates. Load or update a job through `launchctl` only during an intended
service installation or deployment. There is no polling waker: agents hear about work through events (Codex's
queue, Claude Code's background request).

`python3 tools/install_agent_guard.py` installs a command-only PreToolUse guard for local Codex only,
preserving existing settings and hooks. Claude Code is not guarded: Yadong allows its Taska long-poll wait
(`/next?wait`, one background command that ends only when work arrives), and the installer removes an earlier
Claude Code install. It rejects recognizable scheduled message checks at any frequency and
Taska queue polling loops. It performs no model calls, has no timer, and is separate from Codex event
delivery, which requires no receiver hook. Tool hooks are a guardrail, not an OS-wide sandbox;
other runtimes and tool paths that bypass hooks are outside their coverage. Validate actual hook interception
after installing or changing a harness; a unit test alone does not establish runtime coverage.
Codex requires user review and trust of new non-managed hooks through `/hooks` before execution; installing
`hooks.json` alone does not enable enforcement. Do not edit trust records or bypass that approval. After official
trust, the live acceptance on 2026-10-28 denied the harmless idle-check probe before its HTTP request ran.
Existing loaded sessions must reload their hook configuration; installation and trust alone do not prove this.
See [codex-notifications.md](codex-notifications.md) for the separate event-delivery acceptance gate.

`python3 tools/install_manager_guard.py add [SESSION]` (from the main checkout, which the hook command points to)
registers a manager session and installs `tools/manager_guard.py` as a PreToolUse hook in
`~/.claude/settings.json`; `--harness codex` uses `~/.codex/hooks.json` instead. Without SESSION it takes the
calling session's id (`CLAUDE_CODE_SESSION_ID`, or `CODEX_THREAD_ID` for Codex). `remove [SESSION]` unregisters
one and `install` only installs or updates the hook, replacing an earlier hand-made `manager-guard.py` entry in
place. Ids live in `manager-sessions.txt` under the harness's `hooks/` folder. For registered sessions only, the
hook denies browser, computer and simulator tools, chat questions and edits outside the manager's memory and temp
folders; every other session and the no-idle guard are untouched. The same Codex `/hooks` trust review applies.

Register permanent service entry points in Local Hub and update the existing registration when their source or
startup path changes. Keep data outside the source checkout in `~/.taska`.
