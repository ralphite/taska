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

Install browser binaries once with `cd web && npx playwright install chromium`. Browser checks must respect the
machine's browser budget. Run potentially destructive journeys on copied data; inspect the actual live app after
deployment to verify the service and existing records still work.

`tools/nightly-checks.sh [data root]` checks the latest committed source in an isolated temporary checkout and a
backup of the data (default `~/.taska`). It runs ordinary code, never a model. It reports test failures to Taska.

## Storybook

Storybook runs independently from the Taska server at `http://127.0.0.1:6007`:

```sh
npm --prefix web run storybook
```

On the managed development machine, the existing `com.taska.storybook-app` LaunchAgent owns that port. Reuse it;
do not start a second instance. Static component stories use the product components and props. Demos exercise
real interactions with mock services. Storybook is not bundled into the deployed app.

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
service installation or deployment. The agent waker remains opt-in; rendering its template does not enable it.

Register permanent service entry points in Local Hub and update the existing registration when their source or
startup path changes. Keep data outside the source checkout in `~/.taska`.
