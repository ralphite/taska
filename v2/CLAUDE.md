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
- Checks (T475): every spec in `v2/web/e2e` names what it guards on a `// guards:` line; a check of one of Yadong's
  requirements starts its title with the codes of his inputs (`r494 r308: ...`, in `v2/web/e2e/req`).
  `zsh v2/tools/ship.sh` runs the checks guarding what changed since the last ship and stops on a failure, quoting
  his words; every check runs each night (`v2/tools/nightly-checks.sh`, a bug in Taska when one fails). A new clear
  requirement gets its check the same day; a bug that came back gets one when it is fixed. A check that stops a
  change meant to undo a requirement is changed only after Yadong agreed in the item.
- Design problems are said, not worked around (10-23, two lessons). A rewrite is a new design in a new folder: the old
  code is a behaviour reference only, never a structure to port (the React "rewrite" ported the one-file page's global
  state and has to be redone). When a standard tool (Storybook, tests, router, state library) needs home-made
  machinery to work, stop: compare with its normal use in its docs, and if our code's design is the cause, tell Yadong
  the root cause and the options before building anything (Storybook once loaded the whole app in a frame and cropped
  it, because components could not render from props). Stop signals: the support code outgrows the thing; copying
  framework internals (CSS rules, fake servers, fake network); hundreds of lines for what takes a few elsewhere; tens
  of seconds per run. Hard to test or to render alone is a design bug to report.
