---
name: taska-ux-audit
description: Audit Taska's UX with two subagents and hidden known answers that measure how good the audit brief is, then turn the findings into Taska subtasks for the user to approve. Use when the user asks for a full UX review, a periodic audit (T113), or to "find all problems like this one".
---

# Taska UX audit with hidden known answers

The user's method (T81): give auditors a task without telling them about problems you already know. If they
find those, the brief is good and their other findings can be trusted; if they miss them, the brief is weak:
fix it and run again. Then dedupe, verify and file everything as Taska subtasks the user approves.

On T81 the two lenses below reported 67 findings in all, which grouped into 15 subtasks. The scenario lens
found 2 of 4 known answers, and only partly; the matrix lens found all 4. They overlapped little, so run both.
On the phone (T137) they reported 77 findings in 14 groups; the scenario lens found 3.5 of 4, the matrix lens 4.

## 1. Set up (the orchestrator, before any subagent)

1. Make a Taska item for the audit (or use the one the user made) and post the plan there.
2. Pick the scope: desktop, phone, or one area (for example "the input box", "documents").
3. **Known answers.** Collect 3 to 5 real problems in that scope that you confirmed yourself by doing them:
   recent user reports (inputs, item threads) or ones you found. Write them, with how you would recognise each,
   to a scratch file (`<scratch>/audit/seeds.md`). **Never put them in the brief or the prompts.**
4. **Data copy.** Copy the project folders from the data root into a scratch root
   (`<scratch>/audit/<letter>/root/<project>`), one root per auditor, plus a small demo project. Auditors work
   only there: never on the live app (port 7340) and never on the real data root.
5. **Brief.** Fill `brief-template.md` (desktop) or `brief-phone.md` (phone; it shows how to tap and swipe with touch
   events) next to this file into `.mocks/<id>/brief.md`: scope, what the product
   is, the environment (its own port, root, Chrome port), the lenses to stress, the finding format and the
   output. Keep it about the job, not about the known answers.

## 2. Run two auditors in parallel

Use the Agent tool, `model: opus`, high or max effort, in the background, one message with both calls. Each
prompt says: read the brief; its letter (A or B); its app port, data root and Chrome port; its lens; **do not
edit taska.py**; return the whole report as its final message (this harness may refuse a subagent writing
files, so the orchestrator saves the report).

- **A, real work start to finish.** Play the user for a day: capture thoughts (text, screenshot, voice), go
  through what needs you, answer, approve, accept, archive, search, switch projects, use two tabs, come back
  later. Note every surprise.
- **B, the systematic matrix.** List every control and key (sidebar, rail, tabs, list header, bands, row pills
  and hover actions, detail toolbar, the item menu, the box, Go through, New input, project page, every key in
  the `?` sheet, Esc, Back/Forward, reload, right- and double-click). Run each in every context (each tab, each
  item state, full width, Go through, New input, project page, filters open, search active, 1440 and 1024,
  sidebar hidden). Record the grid; every cell that differs without a reason is a finding.

While they run, keep working on other items. The app may change under them: ask them to re-check every finding
on the newest code at the end and to list what got fixed while they tested.

## 3. Score and improve the brief

When a report arrives, save it to `.mocks/<id>/<letter>/findings.md` (screenshots are in its `shots/`).
Score each auditor against the known answers: found / partly / missed. Missed ones show what the brief failed
to ask for (a lens, a context, a state). Tighten the brief and rerun the weaker lens if a known answer was
missed by both.

## 4. Verify, dedupe, group

1. Re-run, on the newest code, every finding that only one auditor reported or that came from an older build.
   Use `scripts/cdp.py` against your own test copy. Drop what no longer happens; note what was fixed meanwhile.
2. Merge duplicates across auditors. Group by **root cause** (for example "one draft for the whole browser",
   "keys act on hidden items", "rows move under the pointer"), not by screen.
3. Severity sets priority: high → P1, medium → P2, low → P3 (one "small issues" group at P3 is fine).

## 5. File and report

1. One subtask per group: `new bug P1 now parent=<audit item> <plain title>`, body in the user's language:
   each symptom in one line with its finding codes (A3, B7) and a note when you re-checked it yourself, then
   one line of direction. Subtasks start as proposed: the user approves which to do.
2. One subtask for anything about the audit process itself.
3. Post on the audit item: the conclusion first; the known-answer table (answer × auditor); how you verified;
   the groups by priority with their codes; 3 or 4 screenshots of the worst problems. Keep it short (R133).
4. Fix the approved ones in priority order, one commit each, and report each on its own item.

## Periodic runs (T113)

The user decided (T113): run an audit **every two weeks, or after about 100 commits since the last one, whichever
comes first**, and fix what it finds **without asking first**; the fixes still go to review as usual.

- **When to check:** whenever `/next` says there is nothing to do. The last run is recorded in
  `.mocks/audit-last.json` (`{"date": "YYYY-MM-DD", "commit": "<hash>", "item": "<code>"}`); it is due when
  `date` is 14 or more days ago, or `git rev-list --count <commit>..HEAD` is 100 or more (changed from 30 on T113).
- **Where the work lives:** T113 itself, which the user approved; agents cannot approve items they create, so a
  run files nothing new. Between runs T113 is `later`, so `/next` does not offer it. When a run is due, set
  `T113 now` and `T113 doing`, run the audit as above, and post in T113: the known-answer table, the groups by
  priority, then one message per fix (one commit each, `(T113: <group>)` in the subject).
- **Seed** the known answers with the user's latest reports in the area most changed since the last run.
- **Fix without asking** (the user's choice), highest priority first; anything that changes how the app works in
  a big way still gets a question first (R133).
- **Close the run:** post the summary (what was found, what was fixed, what is left), then set `T113 open` and
  `T113 later`, never done: it stays for the next run. Write today's date, `git rev-parse --short HEAD` and
  `T113` to `.mocks/audit-last.json`.

## Rules that apply

- R66: findings, briefs and commits pushed anywhere carry no personal data; describe items by code and a few
  words. Screenshots of the user's data stay local or in Taska.
- R55: the user reads Taska only. Everything they should see goes into the item threads.
- Never point a subagent at port 7340 or the real data root; never let it edit the code.
