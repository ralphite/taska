# Taska UX audit (<ID>): shared brief

<!-- Fill the <...> parts. Never mention the known answers here. -->

## The job
Find every place where Taska's **<scope: desktop / phone / an area>** experience does not make sense to a real
user: it is inconsistent, confusing, surprising, slow, or easy to get wrong. **The user experience is what is
being audited**: behavior, flow, placement, feedback, consistency. Be exhaustive; a short list means the audit
failed.

You are an auditor, not a fixer: **do not edit the code**. Report findings with evidence.

## What Taska is
Read `README.md` first. In short: one person shares a task list with their coding agents. The user drops in
inputs (text, screenshots, voice); an organizer, or the agent, turns them into items (features, bugs, ideas,
tasks, rules). Agents post progress, questions and results; the user answers, approves, accepts and archives.
<Describe the layout of the scope: panes, tabs, where the input box is, the keyboard map (`?` in the app).>
Design intent, where there is some: <paths to design notes>. Intent is not proof: judge what the app does.

## Your environment (never touch the live app)
- The live app runs on port 7340 with the user's real data. **Do not open it, call it, or read or write the
  real data root.**
- Start your own copy on your own data copy, in the background, and stop it when you are done:
  `PYTHONPATH=server python3 -m taska --host 127.0.0.1 --port <PORT> --root <ROOT> --organizer off`
  (from the repository root; the page is `web/dist`, built with `npm --prefix web run build`)
  Your root has <projects>. You may change this data freely. To act as the coding agent, use the text API on
  your port: `curl -s "http://127.0.0.1:<PORT>/p/<project>/do?by=claude-code" --data-binary "B03 say hello"`.
- Drive a real browser with `tools/cdp.py` (see its docstring), on Chrome port <CHROME_PORT>.
  - Act like a user: click and type. Use `p.js` only to find where things are and to read state, never to call
    the app's functions as a shortcut. A finding must be reproducible with a mouse and a keyboard.
  - Check the important screens at <sizes>, in light and in dark, and LOOK at each screenshot.
- Read the code (`server/taska` for the server, `web/src` for the page) only **after** you have seen a
  problem in the UI, to explain it.

## Your lens: <A: real work start to finish / B: the systematic matrix>
<Paste the lens from SKILL.md, step 2.>

## Also look through these
1. **The same action, different places.** Every action should behave the same in every context, or the
   difference must be obvious and justified.
2. **Spatial logic.** Where does new content appear compared with where you created it?
3. **State and memory.** What survives switching tab, project, reload, Back/Forward: selection, scroll, a draft,
   filters, search? Is the URL right?
4. **Feedback.** After each action: do you know it happened, where your thing went, and how to undo it?
5. **Error prevention.** How easy is it to send to the wrong place, act on the wrong item, or lose work?
6. **Keyboard and focus.** Where is focus after each action? Do keys do what the `?` sheet says everywhere?
7. **Words and labels.** Does a label promise something else? Two names for one thing, or one name for two?
8. **Changing what already exists.** Edit and add to a sent input, change an item's type, priority, status and
   parent, rename it, merge it. What does the thread show afterwards, does the code or address change, and is
   there a toast with Undo? (T113 run 1 missed both known answers in this area.)
8. **Efficiency.** Count clicks and keys for common jobs; look for dead ends and detours.
9. **Edge states.** Empty, very long, many, nothing selected, an item that disappears while open, two tabs.

## Each finding
Verify it by doing it, then write:

```
### A12. <short title in plain words>
- Where: <screen / state>
- Steps: 1. … 2. … 3. …
- What happens: …
- Why it does not make sense: <the expectation it breaks; name the principle>
- Severity: high (misleads; wrong actions or lost work) / medium (confusing, slow) / low (polish)
- Evidence: <screenshot paths>
- Direction: <one or two lines on what would make sense>
```

Group duplicates (one root cause = one finding listing its symptoms), rank by severity, and put a one-paragraph
summary with the count per severity at the top. At the end, re-check every finding on the newest code and list
what was fixed while you tested.

## Output
Screenshots go to `.mocks/<ID>/<your letter>/shots/`. Return the whole report as your final message; if you can
write files, also save it as `.mocks/<ID>/<your letter>/findings.md`. No personal data in the text: describe
items by their code and a few words.
