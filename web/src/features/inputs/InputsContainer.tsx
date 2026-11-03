// The phone's Inputs tab with the page's data: each input with where it stands and what became of it, newest first
// by day, and what is still on its way.

import { useMemo, useState } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { NEW_DRAFT } from '../../model/draftTarget'
import { clock } from '../../model/time'
import { useAway, useFiles, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { codeOf, findRef, type ProjectModel } from '../../model/project'
import { searchWords } from '../../model/visible'
import { useItemWorld } from '../../app/hooks'
import { useSearchHints } from '../../app/searchHints'
import { Thumbs } from '../../ui/Files'
import { useBoxHere } from '../../app/inputs/boxHere'
import { InputsView, type InputFacts } from './InputsView'
import { inputRows, outgoingRows } from './inputRows'

/** how many inputs are drawn at first, and how many more each time the list nears its end */
const PAGE = 40

export function InputsContainer({ route, hidden }: { route: ProjectRoute; hidden: boolean }) {
  const app = useServices('box', 'docs', 'fields', 'inputActions', 'inputs', 'nav', 'sheets')
  const stores = useStores('box', 'recording', 'data', 'drafts', 'outbox', 'ui')
  // a voice note being recorded into a new input here: its row comes first, with how long so far (B627)
  const recording = useStoreValue(stores.recording, (st) => (st.rec && st.rec.slug === route.slug && !st.rec.about && st.rec.key === NEW_DRAFT ? clock(st.rec.ms) : null))
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
  // a screenful and more at first, then more as the list scrolls to its end: opening the tab never waits on drawing
  // every input (B645)
  const [upTo, setUpTo] = useState(PAGE)
  const { rows, total }: { rows: InputFacts[]; total: number } = useMemo(() => {
    if (!m || hidden) return { rows: [], total: 0 }
    const title = (slug: string) => projects?.find((p) => p.name === slug)?.title || slug
    return inputRows(m, { words, title, opened, drafts: draftWords || stores.drafts.getState().of(route.slug), writing, lit, litStill, upTo })
  }, [m, hidden, words, projects, opened, draftWords, stores, route.slug, writing, lit, litStill, upTo])
  // an input gone to further down is drawn with those above it, and stays drawn once it is no longer lit (React's
  // adjust-state-while-rendering pattern)
  if (rows.length > upTo) setUpTo(rows.length)
  const outgoing = outgoingRows(outbox, route.slug, away)
  return (
    <InputsView
      recording={recording}
      hidden={hidden}
      rows={rows}
      more={total > rows.length}
      outgoing={outgoing}
      words={words}
      world={world}
      hints={hints(total)}
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
        end: () => setUpTo((n) => n + PAGE),
      }}
    />
  )
}
