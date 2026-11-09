// The items' part of the page, made together: what you do to an item, moving one to another project, picking several,
// dragging, its editor's kept words, answering its questions by their choices, a merged item giving way, and the
// list's order for Previous and Next. `held` is the list's: a row began holding still.

import { holdKey, openItemN } from '../../model/route'
import type { Core } from '../core'
import type { InputsArea } from '../inputs/area'
import { Answers } from './answers'
import { ItemActions } from './itemActions'
import { ItemDrag } from './itemDrag'
import { ItemEdits } from './itemEdits'
import { ListOrder } from './listOrder'
import { Merges } from './merges'
import { Moves } from './moves'
import { Selection } from './selection'

export function makeItems(c: Core, i: Pick<InputsArea, 'inputs' | 'goDraft'>, held: () => void) {
  const { s, toasts, runner } = c
  const open = () => openItemN(s.route.getState().route)
  const listOrder = new ListOrder()
  const items = new ItemActions({
    slug: c.slug,
    model: c.here,
    runner,
    toasts,
    ui: s.ui,
    held,
    listKey: () => holdKey(s.route.getState().route, c.desk()),
    openItem: open,
    desk: c.desk,
    undoSeq: (n, f) => c.here()?.facts.undo.find((u) => u.n === n && f in u.f)?.seq ?? null,
    noteWith: () => false,
  })
  const moves = new Moves({ api: c.api, delivery: c.delivery, runner, toasts, model: c.model, title: c.title, go: c.go, refresh: (sl) => c.project().stale(sl) })
  const selection = new Selection({ ui: s.ui, order: listOrder, runner, toasts, slug: c.slug, model: c.here, open })
  const itemDrag = new ItemDrag({ store: s.drag, items, moves, slug: c.slug, model: c.here })
  const itemEdits = new ItemEdits({ view: s.itemView, kept: s.keptEdits, route: s.route, toasts, desk: c.desk, model: c.here })
  const answers = new Answers({ inputs: i.inputs, view: s.itemView, outbox: s.outbox })
  // a merged item gives way to the one it went into; what you wrote for it goes along
  const merges = new Merges({ route: s.route, data: s.data, drafts: s.drafts, box: s.box, toasts, model: c.model, showItem: (code, tab) => c.nav.openItemHere(code, tab), goDraft: i.goDraft })
  return { listOrder, items, moves, selection, itemDrag, itemEdits, answers, merges }
}
