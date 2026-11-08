// The phone's Inputs tab with the page's data: each input with what became of it, newest first, and what is still on
// its way.

import { useMemo, useState } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useAway, useFiles, useLitFades, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { codeOf, findRef, type ProjectModel } from '../../model/project'
import { useItemWorld } from '../../app/hooks'
import { FileChips } from '../../ui/Files'
import { useBoxHere } from '../../app/inputs/boxHere'
import { InputsView, type InputFacts } from './InputsView'
import { useOtherProjects } from '../../app/projectLists'
import { actsIn } from '../../model/inputStates'
import { inputRows, outgoingRows } from './inputRows'

/** how many inputs are drawn at first, and how many more each time the list nears its end */
const PAGE = 40

export function InputsContainer({ route, hidden }: { route: ProjectRoute; hidden: boolean }) {
  const app = useServices('box', 'docs', 'fields', 'inputActions', 'inputs', 'nav', 'sheets')
  const others = useOtherProjects(route.slug).length
  const stores = useStores('box', 'data', 'drafts', 'outbox', 'route', 'ui')
  // a voice note being recorded into a new input here: its row comes first, with how long so far (B627)
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const outbox = useStoreValue(stores.outbox, (s) => s.list)
  const opened = useStoreValue(stores.ui, (s) => s.openedInputs)
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const world = useItemWorld(m, route.slug)
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
    const got = inputRows(m, { title, opened, drafts: draftWords || stores.drafts.getState().of(route.slug), writing, lit, litStill, upTo })
    // Move, as its menu has it (model/inputStates): another project to go to, and Taska not working on it
    return { ...got, rows: got.rows.map((x) => ({ ...x, movable: actsIn(x.became, 'sheet', { others: others > 0 }).includes('move') })) }
  }, [m, hidden, projects, opened, draftWords, stores, route.slug, writing, lit, litStill, upTo, others])
  // an input gone to further down is drawn with those above it, and stays drawn once it is no longer lit (React's
  // adjust-state-while-rendering pattern)
  if (rows.length > upTo) setUpTo(rows.length)
  useLitFades(lit, rows.some((x) => x.lit))
  const outgoing = outgoingRows(outbox, route.slug, away)
  return (
    <InputsView
      hidden={hidden}
      rows={rows}
      more={total > rows.length}
      outgoing={outgoing}
      world={world}
      files={(f) => <FileChips files={f} url={world.url} play={media.play} tidy={media.tidy} on={media.on} />}
      on={{
        goto: (n) => m && app.nav.openItem(codeOf(m, n), 'items'),
        more: (id) => stores.ui.getState().toggleInput(id),
        menu: (id) => app.sheets.open({ kind: 'input-menu', id }, { focus: false }),
        retry: (id) => app.inputActions.organizeAgain(route.slug, id),
        send: (id) => app.inputActions.sendCancelled(route.slug, id),
        draft: (id, mode) => app.box.amendStart(route.slug, m, id, mode),
        moved: (href) => app.nav.to(href),
        ref: (c) => {
          const to = m ? findRef(m, c) : null
          if (to?.kind === 'item') app.nav.openItem(codeOf(m as ProjectModel, to.n), 'items')
          else if (to?.kind === 'doc') app.docs.open(to.d)
          else if (to?.kind === 'input') app.nav.goInput(to.id)
        },
        picture: (f, all) => media.on.view(f, all),
        outboxRetry: (q) => app.inputs.retry(q),
        outboxEdit: (q) => app.box.editOutgoing(route.slug, boxKey, q, away) && app.fields.focus('box'),
        outboxCancel: (q) => app.box.cancel(q),
        end: () => setUpTo((n) => n + PAGE),
        moveInput: (id) => app.sheets.open({ kind: 'input-move', id }),
        remove: (id) => app.inputActions.remove(route.slug, id),
        swipe: {
          right: (id) => {
            const x = rows.find((y) => y.r.id === id)?.became
            const to = x?.k === 'filed' ? x.items[0]?.item : x?.k === 'answer' ? x.item : undefined
            return to && m ? { slide: false, run: () => app.nav.openItem(codeOf(m, to.n), 'items') } : null
          },
          hold: (id) => app.sheets.open({ kind: 'input-menu', id }, { focus: false }),
          blocked: () => stores.route.getState().layers.includes('drawer'),
        },
      }}
    />
  )
}
