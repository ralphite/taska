---
name: taska-mobile-qa
description: Black-box test Taska on a phone-sized screen, find what is broken or awkward, and report it in Taska with screenshots. Use after changing Taska's UI, or when asked to test Taska on mobile.
---

# Taska mobile QA

Find the problems a phone user would hit, quickly. Test like the user: through the UI only. Read the code only
after you found a problem, to explain it.

## Set up (never test on the live data)

1. Copy the project and start a scratch Taska on another port:
   `cp -R ~/.taska/taska <scratchpad>/qa/` then
   `python3 taska.py --host 127.0.0.1 --port 7341 --root <scratchpad>/qa --organizer off`
   (keep the organizer on only when you test it; it calls Gemini).
2. Built-in browser on `http://127.0.0.1:7341/p/taska/`, viewport 390x844 (a phone: touch, coarse pointer).
   Do the pass in light mode, then the screens that matter again in dark mode.

## The pass

At each step: do it, take a screenshot, look hard. Off by a few pixels, cut-off text, things under the input box or
the Home indicator, two taps where one should do, unclear state: all count.

1. First screen: header (menu icon + project, agent pill, search), tabs with counts and the filter button, then
   the Items list in three groups: Needs you (amber, a one-line quote and an action pill per row, Go through),
   Agent queue (Keep going switch, /next order), Finished (Archive N). With nothing waiting, the list starts at the
   queue. Nothing cut off at 375 and 390 wide. Also the moment before the data arrives (a
   slow tunnel on a phone): the project name and "Loading…" show, not a blank page.
2. Send: text with Shift+Enter, with an image, the mic button. The status line after sending; Undo. Put a long
   paragraph in at once (paste, or the keyboard's dictation): the box grows to fit, no line cut off.
3. Open an item: it is a page of its own (T57). The "needs you" card (review with the agent's report, proposed,
   question with options, blocked), conversation (yours on the right in blue, agents' in cards with an avatar,
   images, "Show more"), subitems, docs, sources, voice notes playing in place, the "⋯" sheet (tiles, type and
   priority segments, status grid). Reply through the "Adding to …" / "Reply to …" chip. Back three ways: the
   arrow, the browser's Back (`history.back()`), a swipe right on the page; and after opening a parent or subitem
   from inside (each step goes back one page). A link with `#B12` opens the page and Back lands on the list.
   Scroll deep into the list or the page, tap something, let a data refresh come in: nothing jumps (B60); after
   Back the list is where you left it.
4. Needs you: the row pills (Accept / Approve happen at once with an Undo toast; Answer / Reply open the focus
   card), Go through (stepper "2 of 4", Next, progress bar; answering, accepting, approving or replying moves to
   the next; after the last: "Nothing else needs you"), a sideways swipe on the card. Gestures: swipe right all
   the way (the forward step, Undo toast), swipe left partway (reverse buttons with icons), the menu icon (drawer
   with projects and This project: Keep going, Connect, Use on your phone, Change log; swipe it back to close),
   long press (the focus card). Taps must not fire after a swipe. The swipe in from the left edge is the phone's
   own "back": Taska must not take it.
5. "Archive N finished items", the Undo countdown, Undo.
6. Search (the header turns into a field; it searches Inputs too), the Filter sheet (type, when, status,
   priority) and the chips under the tabs, the Inputs / Archive / Rules tabs (Rules: Needs you, Active, Retired).
7. Documents: open, tap paragraphs, select text, circle an area, comment, Edit/Done, a new doc.
8. The projects page (`/`), the drawer's project rows and the amber dot on the menu icon when another project
   needs you, the Agents sheet (tap the pill).
9. Edges: very long Chinese and English titles, many items, an empty project, the server stopped ("Offline,
   retrying") and started again (the page recovers and picks up the new version).

Swipes need touch pointer events; mouse drags are ignored on purpose:

```js
const drag = async (el, dx) => { const r = el.getBoundingClientRect(), x0 = r.left + r.width / 2, y = r.top + r.height / 2;
  const ev = (t, x) => el.dispatchEvent(new PointerEvent(t, {pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true}));
  ev('pointerdown', x0); for (let i = 1; i <= 10; i++) { ev('pointermove', x0 + dx * i / 10); await new Promise(r => setTimeout(r, 16)); }
  ev('pointerup', x0 + dx); };
await drag(document.querySelector('[data-swipe="12"]'), 300);  // row F12 all the way right
```

iPhone Safari: if a `touchstart` / `pointerdown` handler makes anything appear (unhide, display change), Safari takes
the tap as a hover and never sends the click (B62: rows would not open). Chrome does not do this, so the
emulator passes. Check in code that nothing is shown at touch down; reveal only once a swipe has started.

Closing the drawer by swipe listens to touch events: dispatch `TouchEvent`s with `new Touch({identifier: 1, target, clientX, clientY})`.

## Report in Taska (the live project)

- Each real problem: `new bug P1 <what is wrong, in the user's words>` with a body: steps, expected, what happened.
  Attach the screenshot: upload it (`curl -s BASE/api/file?name=x.png -H 'Content-Type: image/png' --data-binary @x.png`
  gives its "f") and post `B12 say files=f30-x.png <one line>`. Items you create wait for the user's approval.
- Small, obvious fixes you are sure about: fix them in the same session and say so in the summary.
- One summary on the QA item: what you covered, what passed, the problems (codes), and improvements you suggest.
  The user reads it on the phone: keep it short.

## Keep this skill sharp

When a problem class was found that is worth checking every time, add it to "The pass". When a step never finds
anything and costs a lot, shorten it. Say what you changed in the summary.
