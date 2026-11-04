// The desktop's search dialog (F479) with the page's data: where the search is, the projects (their models where the
// page has them), what you opened lately, the actions the words may name (on the item open), and the highlighted
// row's preview: an item of a project the page has, as its page draws it (read only); anything else, what the search
// knows of it.

import { useEffect } from 'react'
import { useApp, useStores, useStoreValue } from '../app/context'
import { useProjectRoute } from '../app/hooks'
import { useSideProjects } from '../app/projectLists'
import { listedActions } from '../app/actions'
import { ItemPageContainer } from '../features/item/ItemPageContainer'
import { foundMeta, foundPath } from '../model/find'
import { statusWord } from '../model/items'
import type { SheetRequest } from '../stores/sheet'
import { toneOf } from '../ui/tones'
import { FoundPreview, SearchDialog, type DialogEvents } from './SearchDialog'
import { isFound, itemOf, searchDialogView, type DialogPlace, type FoundLine } from './searchDialogView'

const ACTIONS = [...listedActions(true), ...listedActions(false)]

function Preview({ l, place, now }: { l: FoundLine; place: DialogPlace; now: number }) {
  const x = l.found
  const m = place.model(x.project)
  const it = itemOf(x, place)
  if ((x.kind === 'items' || x.kind === 'rules') && it && m?.byN.get(it.n) === it) return <ItemPageContainer it={it} m={m} slug={x.project} tab="items" desk preview />
  if (x.kind === 'docs') {
    const d = m?.docs.find((y) => y.d === x.d)
    return <FoundPreview l={l} text={(d?.md ?? '').slice(0, 1500)} meta={foundMeta(x, now)} />
  }
  if (x.kind === 'inputs') return <FoundPreview l={l} text="" meta={foundMeta(x, now)} />
  return <FoundPreview l={l} text={(it?.body ?? '').slice(0, 1500)} meta={it ? [statusWord(it), it.type === 'rule' ? '' : it.pri].filter(Boolean).join(' · ') : ''} />
}

export function SearchSheet(_: { req: Extract<SheetRequest, { kind: 'search' }> }) {
  const app = useApp()
  const stores = useStores('find', 'recent', 'data')
  const s = useStoreValue(stores.find, (x) => x)
  const recent = useStoreValue(stores.recent, (x) => x.list)
  useStoreValue(stores.data, (x) => x.copies) // a project's data come: its rows and preview draw again
  const listedAt = useStoreValue(stores.data, (x) => x.listedAt)
  const route = useProjectRoute()
  const here = route?.slug ?? ''
  const { list, tones } = useSideProjects(here)
  // the dialog went (Esc, a click outside, a result opened): the microphone stops, nothing under way goes on
  useEffect(() => () => app.finder.leaveDesk(), [app])
  const title = (slug: string) => (list ?? []).find((p) => p.slug === slug)?.title ?? s.answer?.titles[slug] ?? slug
  const place: DialogPlace = {
    here,
    model: (slug) => app.model(slug),
    title,
    tone: (slug) => toneOf(tones, slug),
    projects: (list ?? []).map((p) => p.slug),
    recent,
    actions: route ? ACTIONS : [],
    openCode: route?.place.kind === 'item' ? route.place.ref : null,
  }
  const v = searchDialogView(s, place)
  const on: DialogEvents = {
    type: (words) => app.finder.typeLive(words),
    toTyping: () => app.finder.type(s.words),
    mic: (replace) => void app.finder.listenDesk(replace),
    stop: () => void app.finder.stop(),
    discard: () => app.finder.discard(),
    pick: (fk, k, side) => app.finder.pick(fk, k, side),
    kind: (k) => app.finder.narrow({ kind: k }),
    project: (p) => app.finder.narrow({ project: p }),
    status: (x) => app.finder.narrow({ status: x }),
    select: (i) => app.finder.select(i),
    open: (x, tab) => {
      const url = foundPath(x)
      if (tab) return void window.open(url, '_blank', 'noopener')
      app.finder.closeDesk()
      app.nav.to(url)
    },
    act: (id) => {
      app.finder.closeDesk()
      ;(document.activeElement as HTMLElement | null)?.blur()
      requestAnimationFrame(() => app.actions.run(id))
    },
    close: () => app.finder.closeDesk(),
  }
  return <SearchDialog v={v} preview={isFound(v.lit) ? <Preview l={v.lit} place={place} now={app.model(here)?.at ?? listedAt} /> : null} on={on} />
}
