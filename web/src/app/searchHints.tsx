// Under a search, with the page's data: the other tabs' matches (with a way there), and the other projects'. Both
// the list and Inputs show them.

import { useLayoutEffect } from 'react'
import { useServices, useStores, useStoreValue } from './context'
import type { ProjectRoute } from './hooks'
import type { ProjectModel } from '../model/project'
import { otherTabs } from '../model/visible'
import { toneOf } from '../ui/tones'
import { useSideProjects } from './projectLists'
import { SearchHints } from '../ui/SearchHints'

/** -> the hints for a list that shows `shown` rows. */
export function useSearchHints(route: ProjectRoute, m: ProjectModel | null, words: readonly string[]) {
  const app = useServices('crossSearch', 'nav')
  const stores = useStores('search')
  const q = words.join(' ')
  useLayoutEffect(() => app.crossSearch.want(q, route.slug), [app, q, route.slug])
  const cross = useStoreValue(stores.search, (s) => s)
  const { tones } = useSideProjects(route.slug)
  return (shown: number) => {
    if (!words.length || !m) return null
    return (
      <SearchHints
        other={otherTabs(m, words, route.tab, shown)}
        cross={cross.q === q ? cross : null}
        tone={(slug) => toneOf(tones, slug)}
        onShow={(t) => app.nav.tab(t)}
        onGo={(href) => app.nav.to(href)}
      />
    )
  }
}
