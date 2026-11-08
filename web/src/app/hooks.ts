// What containers read: the route, the open project's model, its facts, the projects' list. Each draws again only
// when what it reads changes.

import { useEffect, useMemo } from 'react'
import { playOf, type PlayState } from '../stores/media'
import { findRef, type ProjectModel } from '../model/project'
import { codeBlock } from '../model/markdown'
import type { Doc } from '../model/types'
import type { InlineWorld } from '../ui/markdown/inline'
import type { Route } from '../model/route'
import { useApp, useStores, useStoreValue } from './context'

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

/** An input gone to stays lit until its row is drawn (its project's inputs may still be on their way), then for a
 * moment more; `shown`: the lit input `id` is among the rows. */
export function useLitFades(id: string | null, shown: boolean): void {
  const stores = useStores('ui')
  useEffect(() => {
    if (!id || !shown) return
    // not stopped when the list goes: a light left on would come back with it
    setTimeout(() => {
      if (stores.ui.getState().lit === id) stores.ui.getState().setLit(null)
    }, 1600)
  }, [stores, id, shown])
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

/** What the Markdown of a project knows: its codes, its files' addresses, its pictures' sizes. */
export function useItemWorld(m: ProjectModel | null, slug: string): InlineWorld {
  const { diagrams } = useApp()
  const stores = useStores('data')
  const sizes = useStoreValue(stores.data, (s) => s.sizes[slug])
  return useMemo(
    () => ({
      find: (c: string) => (m ? findRef(m, c) : null),
      url: (f: string) => `/p/${encodeURIComponent(slug)}/f/${encodeURIComponent(f)}`,
      size: (f: string) => sizes?.[f],
      diagram: (src: string, dark: boolean, id: string) => diagrams.draw(src, dark, id),
    }),
    [m, slug, sizes, diagrams],
  )
}

/** A document's world: a diagram of it that does not draw is told to the agent that wrote it (B714 r1181); the
 * rules and web pages have no such diagrams. */
export function useDocWorld(m: ProjectModel | null, slug: string, d: Doc | undefined): InlineWorld {
  const { diagrams } = useApp()
  const world = useItemWorld(m, slug)
  const blocks = d && d.fmt !== 'html' && d.kind !== 'rules' ? d.blocks : null
  const dn = d?.d ?? 0
  const v = d?.versions ?? 0
  return useMemo(() => {
    const draw = world.diagram
    if (!draw || !blocks) return world
    return {
      ...world,
      diagram: (src: string, dark: boolean, id: string) =>
        draw(src, dark, id).catch((e: unknown) => {
          const b = blocks.find((x) => {
            const c = x.kind === 'code' ? codeBlock(x.text) : null
            return c?.kind === 'code' && c.text === src
          })
          if (b) diagrams.failed(slug, { d: dn, v, key: b.key }, e)
          throw e
        }),
    }
  }, [world, blocks, dn, v, slug, diagrams])
}
