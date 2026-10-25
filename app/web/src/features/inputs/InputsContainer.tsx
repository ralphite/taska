// The phone's Inputs tab with the page's data: each input with where it stands and what became of it, newest first
// by day, and what is still on its way.

import { useMemo } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useAway, useFiles, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { codeOf, findRef, type ProjectModel } from '../../model/project'
import { searchWords } from '../../model/visible'
import { useItemWorld } from '../../app/hooks'
import { useSearchHints } from '../../app/searchHints'
import { Thumbs } from '../../ui/Files'
import { useBoxHere } from '../composer/boxHere'
import { InputsView, type InputFacts } from './InputsView'
import { inputRows, outgoingRows } from './inputRows'

export function InputsContainer({ route, hidden }: { route: ProjectRoute; hidden: boolean }) {
  const app = useServices('box', 'docs', 'fields', 'inputActions', 'inputs', 'nav', 'sheets')
  const stores = useStores('box', 'data', 'drafts', 'outbox', 'ui')
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const outbox = useStoreValue(stores.outbox, (s) => s.list)
  const opened = useStoreValue(stores.ui, (s) => s.openedInputs)
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const words = useMemo(() => searchWords(route.list.q), [route.list.q])
  const world = useItemWorld(m, route.slug)
  const hints = useSearchHints(route, m, words)
  const draftWords = useStoreValue(stores.drafts, (s) => s.bySlug[route.slug])
  const mode = useStoreValue(stores.box, (s) => s.mode)
  const writing = useMemo(() => (mode?.kind === 'amend' ? { id: mode.id, mode: mode.mode } : null), [mode])
  const media = useFiles(route.slug)
  const { key: boxKey } = useBoxHere(route)
  const lit = useStoreValue(stores.ui, (s) => s.lit)
  const litStill = useStoreValue(stores.ui, (s) => s.litStill)
  const rows: InputFacts[] = useMemo(() => {
    if (!m || hidden) return []
    const title = (slug: string) => projects?.find((p) => p.name === slug)?.title || slug
    return inputRows(m, { words, title, opened, drafts: draftWords || stores.drafts.getState().of(route.slug), writing, lit, litStill })
  }, [m, hidden, words, projects, opened, draftWords, stores, route.slug, writing, lit, litStill])
  const outgoing = outgoingRows(outbox, route.slug, away)
  return (
    <InputsView
      hidden={hidden}
      rows={rows}
      outgoing={outgoing}
      words={words}
      world={world}
      hints={hints(rows.length)}
      files={(f) => <Thumbs files={f} url={world.url} size="size-11" play={media.play} tidy={media.tidy} on={media.on} />}
      on={{
        goto: (n) => m && app.nav.openItem(codeOf(m, n), 'items'),
        more: (id) => stores.ui.getState().toggleInput(id),
        menu: (id) => app.sheets.open({ kind: 'input-menu', id }, { focus: false }),
        retry: (id) => app.inputActions.organizeAgain(route.slug, id),
        draft: (id, mode) => app.box.amendStart(route.slug, m, id, mode),
        moved: (href) => app.nav.to(href),
        ref: (c) => {
          const to = m ? findRef(m, c) : null
          if (to?.kind === 'item') app.nav.openItem(codeOf(m as ProjectModel, to.n), 'items')
          else if (to?.kind === 'doc') app.docs.open(to.d)
          else if (to?.kind === 'input') app.nav.goInput(to.id, (x) => stores.ui.getState().setLit(x))
        },
        picture: (f, all) => media.on.view(f, all),
        outboxRetry: () => void app.inputs.flush(),
        outboxEdit: () => app.box.editOutgoing(route.slug, boxKey) && app.fields.focus('box'),
      }}
    />
  )
}
