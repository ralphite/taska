# Taska v2

The rewrite of Taska: a typed Python backend on SQLite and a React frontend, with the same agent interface and the
same features as the one-file `taska.py`. See [spec/product-spec.md](spec/product-spec.md) for what it does and
[spec/architecture.md](spec/architecture.md) for how it is built.

## Run it

```sh
# once: a copy of your data (the old data is only read)
PYTHONPATH=v2/server python3 -m taska import --from ~/.taska --to ~/taska-v2-data

# the page (once, and after frontend changes)
npm --prefix v2/web install
npm --prefix v2/web run build

# the server, next to the old one
PYTHONPATH=v2/server python3 -m taska --port 7341 --root ~/taska-v2-data
```

Or the single file from a release: `python3 taska.pyz --port 7341 --root ~/taska-v2-data`.

## Develop

| What | Command |
|---|---|
| Frontend with hot reload (API on 7341) | `npm --prefix v2/web run dev` (http://127.0.0.1:5341) |
| Storybook (components, pages, prototypes) | always on at http://127.0.0.1:6007 from the source (LaunchAgent `com.taska.storybook` runs `v2/tools/storybook-service.sh`); not part of Taska |
| Type checks | `npm --prefix v2/web run typecheck` and `npm --prefix v2/web run typecheck:server` |
| Lint | `npm --prefix v2/web run lint` |
| Frontend unit tests | `npm --prefix v2/web test` |
| Agent API compatibility | `python3 v2/tests/test_compat.py` |
| Old data imports the same | `python3 v2/tests/check_import.py <old taska.py> <copy of ~/.taska>` |
| Behaviour tests, v2 (a fresh data folder each run) | `python3 v2/tests/run_e2e.py` |
| The same tests on the old app | `python3 v2/tests/run_e2e.py --old taska.py` |
| The single file | `python3 v2/tools/build_pyz.py` (builds the page, then `v2/dist/taska.pyz`; `--skip-web` uses the page already built) |

Never point a development server at `~/.taska`: use a copy.

## Behaviour still being decided

`v2/web/src/lib/behaviour.ts` holds the behaviours that wait on a decision (D21 on T318, F291, I289). Each is one
switch; the defaults are the one-file Taska's behaviour, so v2 does what the old app does until a decision changes one.
