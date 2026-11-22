// The tasks' part of the page, made together: what you do to a task, moving one to another project, picking several,
// dragging, its editor's kept words, answering its questions by their choices, a merged task giving way, and the
// list's order for Previous and Next. `held` is the list's: a row began holding still.

import { holdKey, openTaskN } from '../../model/route'
import { inWorkOrder } from '../../model/visible'
import type { Core } from '../core'
import type { InputsArea } from '../inputs/area'
import { Answers } from './answers'
import { TaskActions } from './taskActions'
import { TaskDrag } from './taskDrag'
import { TaskEdits } from './taskEdits'
import { ListOrder } from './listOrder'
import { Merges } from './merges'
import { Moves } from './moves'
import { Selection } from './selection'

export function makeTasks(c: Core, i: Pick<InputsArea, 'inputs' | 'goDraft' | 'keptNotes' | 'box'>, held: () => void) {
  const { s, toasts, runner } = c
  const open = () => openTaskN(s.route.getState().route)
  const listOrder = new ListOrder()
  const tasks = new TaskActions({
    slug: c.slug,
    model: c.here,
    runner,
    toasts,
    ui: s.ui,
    held,
    listKey: () => holdKey(s.route.getState().route, c.desk()),
    openTask: open,
    desk: c.desk,
    undoSeq: (n, f) => c.here()?.facts.undo.find((u) => u.n === n && f in u.f)?.seq ?? null,
    noteWith: () => false,
  })
  const moves = new Moves({ api: c.api, delivery: c.delivery, runner, toasts, model: c.model, title: c.title, go: c.go, refresh: (sl) => c.project().stale(sl), drafts: s.drafts, box: s.box, carry: (fs, to, key) => i.keptNotes.carry(fs, to, key) })
  const selection = new Selection({ ui: s.ui, order: listOrder, runner, toasts, slug: c.slug, model: c.here, open })
  const taskDrag = new TaskDrag({
    store: s.drag,
    tasks,
    moves,
    slug: c.slug,
    model: c.here,
    ordered: () => {
      const r = s.route.getState().route
      return r.page === 'project' && inWorkOrder(r.tab, r.list)
    },
  })
  const taskEdits = new TaskEdits({ view: s.taskView, kept: s.keptEdits, route: s.route, toasts, desk: c.desk, model: c.here })
  const answers = new Answers({ inputs: i.inputs, view: s.taskView, outbox: s.outbox, box: i.box })
  // a merged task gives way to the one it went into; what you wrote for it goes along
  const merges = new Merges({ route: s.route, data: s.data, drafts: s.drafts, box: s.box, toasts, model: c.model, showTask: (code, tab) => c.nav.openTaskHere(code, tab), goDraft: i.goDraft })
  return { listOrder, tasks, moves, selection, taskDrag, taskEdits, answers, merges }
}
