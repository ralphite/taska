# Rewrite (F581): findings

Things found while rewriting that would change what Yadong sees or uses. Until Yadong ticks one, the rewrite does
what the old version does. Each is also sent to the coordinator ("Nota & Taska dev") when found.

## Behaviour

- [ ] **`python3 -m taska import` is gone.** The old version reads a one-file Taska's `taska.jsonl` into `taska.db`.
  All of Yadong's projects were imported on 2026-10-19 and the one-file Taska was removed, so the rewrite does not
  carry the importer: the command says the data was imported already and stops. Keeping it would mean writing an
  importer for a format nothing writes any more. (Asked: drop it, or carry it.)
- [ ] **The sidebar's Storybook link** points at this project's own Storybook (port 6351), not the old one's (6007).
  Reported by the parity check; the coordinator is asking Yadong.
- [ ] **No 0.3 s first frame while loading.** The old page shows a passing frame for about 0.3 s while it loads; the
  rewrite draws the page at once. Reported by the parity check; the coordinator is asking Yadong.

## Glitches of the old version not copied

(none yet)
