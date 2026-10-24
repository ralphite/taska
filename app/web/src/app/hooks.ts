// What containers read: the route, the open project's model, its facts, the projects' list. Each draws again only
// when what it reads changes.

import { useEffect, useMemo } from 'react'
import { playOf, type PlayState } from '../stores/media'
import type { ProjectModel } from '../model/project'
import type { Route } from '../model/route'
import { useApp, useStoreValue } from './context'

export type ProjectRoute = Extract<Route, { page: 'project' }>

export function useRoute(): Route {
  const app = useApp()
  return useStoreValue(app.stores.route, (s) => s.route)
}

export function useProjectRoute(): ProjectRoute | null {
  const r = useRoute()
  return r.page === 'project' ? r : null
}

/** The project's model: the server's copy with your pending changes over it (null until its data comes). */
export function useProjectModel(slug: string): ProjectModel | null {
  const app = useApp()
  // subscribed to both, so a change to either draws again; the app keeps one model per copy and pending changes
  const copy = useStoreValue(app.stores.data, (s) => s.copies[slug])
  useStoreValue(app.stores.changes, (s) => s.list)
  return copy ? app.model(slug) : null
}

/** How sure the page is that the server is away (2 and more: it says so). */
export function useAway(slug: string): number {
  const app = useApp()
  return useStoreValue(app.stores.data, (s) => s.away[slug] || 0)
}

/** A sheet whose subject went (deleted, moved, merged meanwhile) closes. */
export function useCloseSheetWhen(gone: boolean): void {
  const app = useApp()
  useEffect(() => {
    if (gone) app.sheets.close()
  }, [app, gone])
}

/** The files of what was said, with the page: a voice note's chip plays it and shows where it is, a picture opens
 * the viewer, the original words their sheet. */
export function useFiles(slug: string): { play(src: string): PlayState; /** a voice note's words were tidied: its original words can be had */ tidy: boolean; on: { play(src: string): void; words(f: string): void; view(f: string, all: string[]): void } } {
  const app = useApp()
  const player = useStoreValue(app.stores.media, (s) => s.player)
  const tidy = useStoreValue(app.stores.settings, (s) => s.prefs?.tidy !== false)
  return useMemo(
    () => ({
      play: (src: string) => playOf(player, src),
      tidy,
      on: { play: (src: string) => app.media.play(src), words: (f: string) => app.media.words(slug, f), view: (f: string, all: string[]) => app.media.view(slug, all, f) },
    }),
    [app, player, slug, tidy],
  )
}
