# Taska phone UX audit (<ID>): shared brief

<!-- Fill the <...> parts. Never mention the known answers here. Used for T137. -->

## The job
Find every place where Taska's **phone** experience (the layout below 1024px wide) does not make sense to a real
user: it is inconsistent, confusing, surprising, slow, hard to reach with a thumb, or easy to get wrong. **The
user experience is what is being audited**: behavior, flow, placement, feedback, consistency, and whether the
phone and the desktop treat the same thing the same way without a reason not to. Be exhaustive; a short list
means the audit failed.

You are an auditor, not a fixer: **do not edit taska.py**. Report findings with evidence.

## What Taska is
Read `README.md` first. In short: one person shares a task list with their coding agents. The user drops in
inputs (text, screenshots, voice); an organizer, or the agent, turns them into items (features, bugs, ideas,
tasks, rules). Agents post progress, questions and results; the user answers, approves, accepts and archives.

On the phone the user is often away from the computer: walking, between meetings, one hand. The layout:
- a header (menu for projects and settings, the project name, the agent badge, search);
- the tabs Items, Inputs, Archive, Rules, and a filter button;
- the list, grouped (Needs you, Agent queue, Finished), with swipe actions on rows and a pill on rows that need you;
- an item opens as its own page; "Go through" walks what needs you in a card;
- documents, the image viewer and menus open as sheets;
- one input box at the bottom for everything (new input, reply, document comment, adding details to an input),
  with attach, voice and send.
The desktop (1024px and wider) is out of scope, but compare with it when the phone does the same job differently.

## Your environment (never touch the live app)
- The live app runs on port 7340 with the user's real data. **Do not open it, call it, or read or write the
  real data root (`~/.taska`).**
- Start your own copy, in the background, and stop it when you are done:
  `python3 taska.py --host 127.0.0.1 --port <PORT> --root <ROOT> --organizer off`
  Your root has <projects: a realistic copy of the user's project and the small demo>. Change this data freely. To act as the coding agent, use the text
  API on your port: `curl -s "http://127.0.0.1:<PORT>/p/my-app/do?by=claude-code" --data-binary "B03 say hello"`.
- Drive headless Chrome with `scripts/cdp.py` (read its docstring) on Chrome port <CHROME_PORT>, as a phone:
  ```python
  import sys, time, json; sys.path.insert(0, 'scripts'); from cdp import Page
  p = Page(size=(390, 844), port=<CHROME_PORT>, flags=('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'))
  p.call('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True)
  p.call('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
  def tap(x, y):    # a finger tap; with touch on, mouse clicks are not taps
      p.call('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': x, 'y': y}])
      p.call('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])
  def swipe(x0, y0, x1, y1, steps=8):
      p.call('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': x0, 'y': y0}])
      for i in range(1, steps + 1):
          p.call('Input.dispatchTouchEvent', type='touchMove', touchPoints=[{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps}]); time.sleep(0.02)
      p.call('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])
  ```
  Long-press = touchStart, wait about 0.6 s, touchEnd. Type with `p.call('Input.insertText', text=...)`.
  - Act like a user: tap, swipe, type. Use `p.js` only to find where things are (getBoundingClientRect) and to
    read state, never to call the app's functions as a shortcut. A finding must be reproducible with a finger.
  - Check the important screens at 390x844, and also at 360x740 and 430x932, in light and in dark (set dark with
    `p.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-color-scheme', 'value': 'dark'}])`). LOOK at
    every screenshot with the Read tool; most phone problems are visible, not in the state.
  - The on-screen keyboard cannot be emulated: note where it would cover things, but don't guess beyond that.
- Read taska.py only **after** you have seen a problem, to explain it.

## Your lens: <LENS>

## Also look through these
1. **The same action, different places.** Every action should behave the same on every screen (list, item page,
   Go through card, sheets), and the same as on the desktop unless the phone has a reason.
2. **Thumb and reach.** Can you reach what you use most with one hand? Are tap targets at least 44px and far
   enough apart? Do swipes conflict with scrolling or with the edge "back" swipe?
3. **Spatial logic.** Where does new content appear compared with where you created it? Is anything hidden under
   the input box, the header, a sheet, or the home bar?
4. **State and memory.** What survives opening an item and coming back, a reload, Back, switching tab or project:
   scroll, a draft, filters, search, the open sheet? Is the address right?
5. **Feedback.** After each action: do you know it happened, where your thing went, and how to undo it?
6. **Error prevention.** How easy is it to send to the wrong place, act on the wrong item, or lose what you typed
   or recorded?
7. **Words and labels.** Does a label promise something else? Two names for one thing, or one name for two?
8. **Efficiency.** Count taps for common jobs; look for dead ends and detours.
9. **Edge states.** Empty, very long text, many items, images, nothing in a group, an item that disappears while
   open, slow network (`Network.emulateNetworkConditions`), offline.

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
summary with the count per severity at the top. At the end, re-check every finding on the newest code (the app
may change while you work; restart your server to pick it up) and list what was fixed while you tested.

## Output
Screenshots go to `.mocks/<ID>/<your letter>/shots/`. Return the whole report as your
final message; if you can write files, also save it as `.mocks/<ID>/<your letter>/findings.md`. No personal data in
the text: describe items by their code and a few words.
