# Working on Taska v2 (for coding agents)

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
