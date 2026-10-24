// The page's one player of voice notes (what plays, whether it is playing, where it is) and its picture viewer (the
// pictures of one message or box, which one, fit to the screen or at 100%). Whether the viewer is open is the
// route's: Back closes it.

import { createStore, type StoreApi } from 'zustand/vanilla'

export interface PlayState {
  playing: boolean
  /** where it is, ms (null: not known yet) */
  t: number | null
}

export interface MediaState {
  player: { src: string; playing: boolean; t: number | null } | null
  viewer: { slug: string; group: readonly string[]; idx: number; fit: boolean }
  played(p: MediaState['player']): void
  view(v: MediaState['viewer']): void
}

export type MediaStore = StoreApi<MediaState>

export function createMediaStore(): MediaStore {
  return createStore<MediaState>()((set) => ({
    player: null,
    viewer: { slug: '', group: [], idx: 0, fit: true },
    played: (player) => set({ player }),
    view: (viewer) => set({ viewer }),
  }))
}

/** What a chip for recording `src` shows. */
export const playOf = (player: MediaState['player'], src: string): PlayState => (player && player.src === src ? { playing: player.playing, t: player.t } : { playing: false, t: null })
