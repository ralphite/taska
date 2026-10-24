// Under a search, with the page's data: the other tabs' matches (with a way there), and the other projects'.

import { useLayoutEffect } from 'react'
import { useApp, useStoreValue } from '../../app/context'
import type { ProjectRoute } from '../../app/hooks'
import type { ProjectModel } from '../../model/project'
import { hay, inTab, inputMatch } from '../../model/visible'
import { TABS, type Tab } from '../../model/words'
import { toneOf } from '../../ui/tones'
import { useSideProjects } from '../sidebar/SidebarContainer'
import { SearchHints } from './SearchHints'

/** -> the hints for a list that shows `shown` rows. */
export function useSearchHints(route: ProjectRoute, m: ProjectModel | null, words: readonly string[]) {
  const app = useApp()
  const q = words.join(' ')
  useLayoutEffect(() => app.crossSearch.want(q, route.slug), [app, q, route.slug])
  const cross = useStoreValue(app.stores.search, (s) => s)
  const { tones } = useSideProjects(route.slug)
  return (shown: number) => {
    if (!words.length || !m) return null
    const other =
      shown >= 5
        ? []
        : TABS.filter((t) => t !== route.tab)
            .map((t): [Tab, number] => [t, t === 'inputs' ? m.inputs.filter((r) => inputMatch(r, words)).length : m.items.filter((it) => !it.mergedInto && inTab(it, t) && words.every((w) => hay(it).includes(w))).length])
            .filter(([, k]) => k)
    return (
      <SearchHints
        other={other}
        cross={cross.q === q ? cross : null}
        tone={(slug) => toneOf(tones, slug)}
        onShow={(t) => app.nav.tab(t)}
        onGo={(href) => app.nav.to(href)}
      />
    )
  }
}
