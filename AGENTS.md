# Working on Taska

## Start here

- `README.md`: product and quick start.
- `docs/architecture.md`: server layers, frontend boundaries and data flow.
- `docs/development.md`: development, checks, packaging and services.
- `server/taska/` is the Python server; `web/` is the React frontend; `tests/` holds server tests;
  `tools/` holds development and service commands. `web/src/app/` is the frontend composition layer.

## Runtime and checks

Use Node.js 26 (`nvm use`; `.nvmrc` is authoritative). The server and release archive support Python 3.9+;
run the development test suite with Python 3.11+.

```sh
npm ci --prefix web
npm --prefix web run check
npm --prefix web run build
python3 tools/e2e.py --all
python3 tools/copy_data.py ~/.taska /tmp/taska-data-copy
python3 tests/check_data.py /tmp/taska-data-copy
python3 tools/build_pyz.py --skip-web
python3 tools/check_package.py dist/taska.pyz
```

Install Chromium once with `cd web && npx playwright install chromium`. Browser checks use isolated servers and
data. Choose targeted checks while iterating, then run the checks appropriate to the complete change.

## Development and deployment

- Keep the architecture boundaries in `docs/architecture.md`; the automated checks enforce them.
- The backend uses the Python standard library. Frontend components and stories share real product components.
- Never start development servers on the live data root `~/.taska`. Use a separate root or `tools/copy_data.py`.
- Development defaults: API 7341, Vite 5341. Production is 7340; Storybook is 6007 and independent of the server.
- Reuse the existing managed services. Do not start duplicate instances or restart services just for inspection.
  `tools/install_launchd.py` only renders selected service definitions; it never starts or stops them.
- `tools/ship.sh` checks, builds and deploys without restarting under active use. Verify changed workflows against
  the actual service and existing data after deployment; temporary-data tests alone do not complete acceptance.
- Keep new source, comments, documentation and commit messages in English; no personal data or secrets in commits.
