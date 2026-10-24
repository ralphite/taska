# Rewrite (F581): findings

Things found while rewriting that would change what Yadong sees or uses. Until Yadong ticks one, the rewrite does
what the old version does. Each is also sent to the coordinator ("Nota & Taska dev") when found.

## Behaviour

- [x] **`python3 -m taska import` is gone.** The old version reads a one-file Taska's `taska.jsonl` into `taska.db`.
  All of Yadong's projects were imported on 2026-10-19 and the one-file Taska was removed. Decided (coordinator,
  10-23, by R410: no legacy): dropped, with its options and the check for not-imported one-file projects.
- [ ] **The sidebar's Storybook link** points at this project's own Storybook (port 6351), not the old one's (6007).
  Reported by the parity check; the coordinator is asking Yadong.
- [ ] **No 0.3 s first frame while loading.** The old page shows a passing frame for about 0.3 s while it loads; the
  rewrite draws the page at once. Reported by the parity check; the coordinator is asking Yadong.
- [ ] **Documents (the side list) never says when a document was written.** The old list sorts by and shows a
  document's `t`, which the server never sends (it sends `t0` and `t1`), so it shows no time and lists the newest
  number first. The rewrite does the same. Showing `t1` ("· 14:30") would be a change: only with Yadong's yes.
- [ ] **One click on a dotted (unsure) word in the Draft card does not open the correction.** On the desktop's New
  input page, the old code means one click on a word the model was unsure of to open the small field to correct it
  (I176), but it only selects the word; double-clicking or dragging over words does open the field. The rewrite does
  the same. Opening the field on one click would be a change: only with Yadong's yes.

## Glitches of the old version not copied

- **A voice note sent before a reload, going out again: its row shows at once.** On the New input page the old
  page puts it back on its way after a reload but does not draw its row ("Voice note · Uploading…") until it is in;
  the rewrite shows the row while it goes, as it does for anything else on its way. It is sent the same way.
- **Leaving a document's editor while it records stops the microphone.** The old page keeps recording out of sight
  (its Stop button is gone with the editor) until the page is left; the rewrite stops it when the editor closes, and
  the words still go into the draft kept for it, as they do in the old one once stopped.
- **From an item's sources to one of its inputs (the phone): the input comes into view, lit.** The old page means to
  (B131) and does so from the talk, but from the Sources sheet the sheet's closing undoes the scroll and the list shows
  its top; the rewrite closes the sheet first, then goes there.
- **An item that shows has no blue dot on its row.** The old page marks what the agents wrote as seen when the item
  shows, but its row keeps the dot until the list happens to draw again (an item merged into the one you look at, its
  row lit with a dot for a moment); the rewrite takes the dot off at once.
- **Words put into your draft from elsewhere keep your place in it.** The old box keeps the caret when a voice note's
  words are placed in the middle after a reload (setRangeText), but when another tab of the browser inserts words in
  the middle of the same draft it jumps the caret to the end; the rewrite keeps it in place for both (another tab's
  words added at the end, or anything else changed there, behave as in the old one).
- **An item's address opened in a new browser: the list shows its row.** The old page scrolls the list to the item
  opened by its address only when it has the project's copy kept from before (nearly always: it draws that first); in
  a browser that never had Taska open its rows come too late for it and the list stays at its top. The rewrite shows
  the row in both, in whichever list it is (Items, Archive, Rules), scrolled as the old one does: as the rows are
  first drawn, before the browser has their heights (so the next row shows a little under it). Where the old page's
  own drawing races its scroll (the same address lands a little higher or lower from one load to the next, or not
  scrolled at all), the rewrite lands where the old one does most of the time.
- **Asked for its key, the page behind does not say Taska is out of reach.** The old page counts the answers that
  ask for the key as Taska being away, so behind the key sheet (after a wrong key) the item says "Taska is out of
  reach, retrying…" though Taska answered; the rewrite keeps saying it is loading the item until the key is right.
