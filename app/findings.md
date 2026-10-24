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

## Glitches of the old version not copied

(none yet)
