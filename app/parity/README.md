# Taska parity: old and new, side by side

The parity acceptance of the Taska rewrite: the same data and the same steps on the old Taska (snapshot
1279806) and on the rewrite, and every difference a user could notice.

- **Page:** http://127.0.0.1:7355/ (LaunchAgent `com.taska.parity-page`; in Local Hub as "Taska parity"): the
  differences of the latest run of the rewrite, the tool's own check, every run's report, and old/new side by side.
- **Old Taska to compare by hand:** http://127.0.0.1:7350/ (LaunchAgent `com.taska.parity-old`), on its own copy of
  the snapshot (`/Users/yadong/taska-rewrite/parity/live-old`). The rewrite runs on 7351.

## Run it

```bash
cd app/parity && npm install                     # once: Playwright, pixelmatch, pngjs, the Tailwind browser build
node compare.mjs --a old --b new                 # every scenario, desktop/phone x light/dark
node compare.mjs --a old --b new --scenarios approve,list --variants desk-light
node selftest.mjs                                # the tool's own check (old vs old twice, then every planted fault)
```

`versions.json` says how to start each version (`{port}`, `{root}` are filled in). A run starts both versions itself,
each on a fresh copy of the snapshot (`data.py`: files cloned, databases through SQLite's backup), on free ports in
7450-7479, and stops them after; it never touches 7340, 7350, 7351 or `~/.taska`.

## What is compared

Each scenario (`scenarios/*.mjs`) runs on both versions at the same moment, step by step, as one user would: a
target is found on the old page and the step acts on that screen point on both, so the new version is driven only
by what it shows. Both pages are reached through one front door (`lib/door.mjs`) at the same address, so every
address a page shows is the same text on both sides. Variants: desktop 1440x900 and phone 393x852 (an iPhone's
user agent, touch), light and dark.

After every step, once both pages are still:

| Kind | How |
|---|---|
| picture | screenshot at device scale; pixelmatch, anti-aliasing ignored, colour threshold 0.03 |
| screens during the step | Chrome's screencast: every screen shown 120 ms or more, in order; one side's screen that the other never painted is a difference |
| motion | every CSS animation and transition (what moves, duration, delay, easing), compared over the scenario |
| text | the whole page's text, scrolled-out parts included |
| accessibility tree | roles and names (what a screen reader or the keyboard meets) |
| address, tab title, dialogs | as they are |
| new errors | console errors, page errors and 5xx answers on the new side only |
| agent answers | word for word (only the data folder's path is replaced) |
| data | after the scenario, every project's database row by row (times written during the run, and random once-only keys, are equal by nature) and the uploaded files |
| speed | per scenario: the new version is slower when its steps took a quarter longer and 300 ms more in all |

A difference is captured again up to twice before it counts (a minute turning over between the two captures).

## Why the tool can be trusted

`selftest.mjs`: the old Taska against itself, all scenarios and variants, twice: nothing may be found. Then each
planted fault in `mutants.mjs` (a copy of the old Taska with one small change, the kind of mistake a rewrite makes:
a colour one shade off, 1 px on the phone only, one word, dark mode only, a hover colour, the address only, the tab
title, a flash during a step, a fade, a console error, one word in the agent guide, data written differently,
live updates broken, slower pages, a slower save) must be found where it is and only there. The result is on the
page under "这个比对工具可信吗".

## Known behaviour of the old Taska (not differences)

- Some pictures with `loading="lazy"` (a thumbnail in a thread, e.g. I447's) stay blank until the page scrolls, in
  Chromium and WebKit alike. The tool does not wait for lazy pictures; the screenshots show what the old page shows.
