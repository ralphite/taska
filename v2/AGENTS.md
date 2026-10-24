# Working on Taska v2 (for coding agents)

> **Since 2026-10-24 12:40 v2 is not the live Taska.** Port 7340 (and the phone, the tunnel) run the rewrite in
> `app/` (F581). v2 is kept only as the backup: `zsh v2/tools/switch-back.sh` puts it back on 7340, same data.
> Do not change or ship v2 (`v2/tools/ship.sh` would restart the live rewrite); work in `app/`, ship with
> `zsh app/tools/ship.sh`. v2 will be deleted once the rewrite has proved itself.

- Everything here is English: code, comments, docs, commit messages. No personal data, no keys.
- The agent interface (`/agent`, `/next`, `/do`, `/items`, cards, `/D1`, `/log`, `/rules`, `/inbox`, `/connect`,
  `/skill`, `/api/file`) must not change by a single word. After any backend change run
  `python3 v2/tests/test_compat.py`; it compares v2 with the old app's recorded answers.
- Backend: Python 3.9+ standard library only, typed; `npm --prefix v2/web run typecheck:server` must stay at 0 errors.
- Frontend: React + TypeScript strict. Style with Tailwind utility classes only; never write CSS. Reuse the
  components in `v2/web/src/components` before making new ones; one input box for every kind of writing.
- Look at what you built: run the real server on a data copy and check the page in a browser at 393x852 and
  1440x900, light and dark. Tests are necessary, not enough.
- Never run a development server on `~/.taska`; import a copy (`python3 -m taska import --from ~/.taska --to ...`).
