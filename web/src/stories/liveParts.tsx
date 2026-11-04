// What the page does for any part that a story draws (T662: what works on the page works in its story): a menu
// opened from a button (the page's sheets.openFrom: under it on the desktop, a sheet from the bottom on the phone),
// voice notes that play, and pictures that open in the page's own viewer. Each is the small state the page's stores
// hold, kept by the story's part.
import { useEffect, useState, type ReactNode } from 'react'
import { Viewer } from '../features/media/Viewer'
import { Sheet, SheetLayout, type SheetLook, type SheetParts } from '../ui/Sheet'
import type { PlayState } from '../ui/Files'
import { act } from './acts'

/** A menu or sheet the part opens, with what it is about (`T`): `open(what, from)` shows it where the page shows it
 * (under the button on the desktop, its frame the window; a sheet from the bottom on the phone), `close()` closes it,
 * `draw(parts)` draws it with the parts made from `what`. */
export function usePop<T>(desk: boolean) {
  const [pop, setPop] = useState<{ what: T; look: SheetLook } | null>(null)
  const open = (what: T, from?: Element | null, look: SheetLook = {}) => {
    const r = from?.getBoundingClientRect()
    const fr = from?.closest('[data-layout]')?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const at = r ? { x: r.right - fr.left, y: r.bottom + 4 - fr.top, right: true, top: r.top - fr.top, left: r.left - fr.left } : null
    setPop({ what, look: { pop: true, at, ...look } })
  }
  const close = () => setPop(null)
  // Esc closes it, as the page's keys do
  const shown = !!pop
  useEffect(() => {
    if (!shown) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [shown])
  /** the same menu, now about `what` (a submenu, Delete asking again) */
  const change = (what: T, look: SheetLook = {}) => setPop((p) => (p ? { what, look: { ...p.look, ...look } } : p))
  const draw = (parts: (what: T) => SheetParts) =>
    pop ? (
      <Sheet open look={pop.look} desk={desk} onClose={close}>
        <SheetLayout {...parts(pop.what)} />
      </Sheet>
    ) : null
  return { open, close, change, draw, what: pop?.what ?? null }
}

/** The page's player and picture viewer: a voice note plays (its time runs) and pauses, a picture opens over the
 * page, fitted or at 100%, and steps through the others it came with. `url` is where a file is. */
export function useMedia(url: (f: string) => string) {
  const [player, setPlayer] = useState<{ src: string; playing: boolean; t: number } | null>(null)
  const [viewer, setViewer] = useState<{ group: readonly string[]; idx: number; fit: boolean } | null>(null)
  const playing = !!player?.playing
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setPlayer((p) => (p && p.playing ? { ...p, t: p.t + 250 } : p)), 250)
    return () => clearInterval(id)
  }, [playing])
  const play = (src: string): PlayState => (player?.src === src ? { playing: player.playing, t: player.t } : { playing: false, t: null })
  const on = {
    play: (src: string) => setPlayer((p) => (p?.src === src ? { ...p, playing: !p.playing } : { src, playing: true, t: 0 })),
    words: act('Voice note: its words → Message parts › Voice notes, pictures, files'),
    view: (f: string, all: readonly string[]) => setViewer({ group: all.length ? all : [f], idx: Math.max(0, all.indexOf(f)), fit: true }),
  }
  const f = viewer ? viewer.group[viewer.idx] : ''
  const node: ReactNode = viewer ? (
    <Viewer
      open
      name={f.replace(/^f\d+-/, '')}
      url={url(f)}
      idx={viewer.idx}
      count={viewer.group.length}
      fit={viewer.fit}
      on={{
        close: () => setViewer(null),
        prev: () => setViewer({ ...viewer, idx: (viewer.idx - 1 + viewer.group.length) % viewer.group.length }),
        next: () => setViewer({ ...viewer, idx: (viewer.idx + 1) % viewer.group.length }),
        zoom: () => setViewer({ ...viewer, fit: !viewer.fit }),
      }}
    />
  ) : null
  return { play, on, node }
}
