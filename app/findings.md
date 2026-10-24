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
