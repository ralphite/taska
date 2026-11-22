// The task's sheets with the page's data: its menu (a sheet on the phone, a menu at the button on the desktop),
// putting it under another task, moving it to another project, what it came from, and a message's menu.

import { useEffect, useLayoutEffect, useState } from 'react'
import type { ActionId } from '../../app/actions'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useCloseSheetWhen, useFiles, useProjectModel, useProjectRoute } from '../../app/hooks'
import { codeOf, type ProjectModel } from '../../model/project'
import type { Input } from '../../model/types'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { Thumbs } from '../../ui/Files'
import { agentCardSheet, laterSheet, messageMenuSheet, sourcesSheet, timesSheet } from './TaskSheets'
import { taskTimes } from '../../model/taskTimes'
import { laterDay, laterDays } from '../../model/time'
import { taskMoveProjectSheet } from '../../ui/ProjectSheets'
import { useOtherProjects } from '../../app/projectLists'
import { taskMenuPop, taskMenuSheet, type TaskMenuEvents } from './TaskMenu'
import { taskMenuFacts } from './taskMenuFacts'
import { toggledTag } from '../../model/tasks'
import { useTaskWorld } from '../../app/hooks'
import { moveParentSheet, pickSheet } from '../../ui/Pickers'

type Req<K extends SheetRequest['kind']> = { req: Extract<SheetRequest, { kind: K }> }

const FIELD_OF = { s: 'status', p: 'pri', t: 'tags' } as const

/** The open project, and the task the sheet is about (closing the sheet when it went). */
function useSubject(n: number) {
  const route = useProjectRoute()
  const slug = route?.slug ?? ''
  const m = useProjectModel(slug)
  const it = m?.byN.get(n)
  useCloseSheetWhen(!!m && !it)
  const code = (k: number) => (m ? codeOf(m, k) : '')
  return { route, slug, m, it, code }
}

export function TaskMenuSheet({ req }: Req<'task-menu'>) {
  const app = useServices('actions', 'fields', 'tasks', 'nav', 'sheets', 'toasts')
  const stores = useStores('sheet')
  const desk = useLayout() === 'desk'
  const { route, slug, m, it, code } = useSubject(req.n)
  const storeArm = useStoreValue(stores.sheet, (s) => s.arm)
  const at = useStoreValue(stores.sheet, (s) => s.spec?.at)
  const asking = useStoreValue(stores.sheet, (s) => !!s.asked['task-delete ' + req.n])
  const others = useOtherProjects(slug)
  const arm = req.arm ?? storeArm
  useLayoutEffect(() => {
    // the desktop's menu: the keys start on its first row (one field's: on the value it has)
    const box = desk ? app.fields.get('sheet') : null
    if (!box || box.contains(document.activeElement)) return
    const f = arm ? FIELD_OF[arm] : null
    const el = (f && (box.querySelector<HTMLElement>(`[data-f="${f}"][aria-pressed="true"]`) || box.querySelector<HTMLElement>(`[data-f="${f}"]`))) || box.querySelector<HTMLElement>('button')
    el?.focus({ preventScroll: true })
  })
  if (!m || !it) return null
  const n = it.n
  const close = () => app.sheets.close()
  const done = (run: () => void) => () => (close(), run())
  // what the table of actions does, on this task (it may not be the open one)
  const run = (id: ActionId) => app.actions.runOn(id, n)
  const on: TaskMenuEvents = {
    edit: done(() => {
      app.nav.openTask(code(n))
      run('edit')
    }),
    copy: done(() => run('copy')),
    agent: () => app.sheets.open({ kind: 'agent-card', n }, { pop: desk, focus: false, at }),
    newDoc: done(() => run('new-doc')),
    addSub: done(() => {
      app.nav.openTask(code(n))
      run('add-sub')
    }),
    reparent: (from) => (desk && from ? app.sheets.openFrom(from, { kind: 'task-move-parent', n }, { focus: false }) : app.sheets.open({ kind: 'task-move-parent', n }, { pop: desk, focus: false, at })),
    later: done(() => run('later')),
    archive: done(() => run('archive')),
    doNext: done(() => void app.tasks.doNext(n)),
    moveProject: () => (others.length ? app.sheets.open({ kind: 'task-move-project', n }, { focus: false }) : (close(), app.toasts.show('No other project to move to'))),
    remove: () => {
      if (!app.sheets.confirm('task-delete ' + n)) return
      void app.tasks.remove(n)
      // on the phone the menu's own step in the history goes first: leaving the deleted task before that would
      // land Back on its page again
      app.sheets.close(() => {
        if (route?.place.kind === 'task') app.nav.closeTask()
      })
    },
    set: (f, v) => {
      if (arm) close()
      void app.tasks.change(n, f, v)
    },
    field: (a) => app.sheets.open({ kind: 'task-menu', n, arm: a }, { pop: true, focus: false, at, narrow: true }),
    tag: (t) => void app.tasks.change(n, 'tags', toggledTag(it.tags, t)),
    group: (on) => (close(), void app.tasks.change(n, 'group', on)),
    waitFor: (from) => (desk && from ? app.sheets.openFrom(from, { kind: 'task-wait-for', n }, { focus: false }) : app.sheets.open({ kind: 'task-wait-for', n }, { pop: desk, focus: false, at })),
  }
  const facts = taskMenuFacts(m, it, asking, arm)
  return desk ? <SheetLayout {...taskMenuPop(facts, on)} /> : <SheetLayout {...taskMenuSheet(facts, on)} />
}

/** Wait for… (T857): any task but itself and the groups; one it waits for already, picked again, no longer. */
export function WaitForSheet({ req }: Req<'task-wait-for'>) {
  const app = useServices('runner', 'sheets')
  const desk = useLayout() === 'desk'
  const { slug, m, it, code } = useSubject(req.n)
  if (!m || !it) return null
  const now = it.after ?? []
  const head = now.length ? `Wait for… (${now.map(code).join(', ')} now: pick again to stop)` : 'Wait for…'
  const pick = (to: number) => {
    app.sheets.close()
    const ref = code(to)
    void app.runner.change(slug, { op: 'after', ref: code(it.n), ...(now.includes(to) ? { del: [ref] } : { add: [ref] }) }, `${code(it.n)} waiting for ${ref}`)
  }
  return <SheetLayout {...pickSheet({ head, tasks: m.tasks, skip: [it.n, ...m.tasks.filter((x) => x.group).map((x) => x.n)], code, desk }, pick)} />
}

export function MoveParentSheet({ req }: Req<'task-move-parent'>) {
  const app = useServices('tasks', 'sheets')
  const desk = useLayout() === 'desk'
  const { m, it, code } = useSubject(req.n)
  if (!m || !it) return null
  return <SheetLayout {...moveParentSheet({ it, tasks: m.tasks, kids: m.kids, code, desk }, (to) => (app.sheets.close(), void app.tasks.change(it.n, 'parent', to)))} />
}

export function MoveTaskProjectSheet({ req }: Req<'task-move-project'>) {
  const app = useServices('moves', 'sheets')
  const { slug, m, it, code } = useSubject(req.n)
  const others = useOtherProjects(slug)
  if (!m || !it) return null
  return (
    <SheetLayout
      {...taskMoveProjectSheet({ code: code(it.n), others }, (to) => {
        app.sheets.close()
        void app.moves.task(slug, it.n, to)
      })}
    />
  )
}

const sourcesOf = (m: ProjectModel, srcs: readonly string[]) => srcs.map((id) => m.byId.get(id)).filter((r): r is Input => !!r && r.kind !== 'answer')

export function SourcesSheet({ req }: Req<'task-sources'>) {
  const app = useServices('nav', 'sheets')
  const { slug, m, it, code } = useSubject(req.n)
  const world = useTaskWorld(m, slug)
  const media = useFiles(slug)
  const desk = useLayout() === 'desk'
  if (!m || !it) return null
  return (
    <SheetLayout
      {...sourcesSheet(
        {
          code: code(it.n),
          inputs: sourcesOf(m, it.srcs),
          world,
          now: m.at,
          files: (f) => <Thumbs files={f} url={world.url} play={media.play} tidy={media.tidy} on={media.on} />,
        },
        // the phone's Inputs lights it where its list is (the sheet's closing takes the list back to its top), as it
        // always has
        (id) => app.sheets.close(() => app.nav.goInput(id, !desk)),
      )}
    />
  )
}

/** When the task was made and last changed, in full (F704 r1157). */
export function TimesSheet({ req }: Req<'task-times'>) {
  const { m, it } = useSubject(req.n)
  if (!m || !it) return null
  return <SheetLayout {...timesSheet(taskTimes(it, m.at))} />
}

export function MessageMenuSheet({ req }: Req<'message-menu'>) {
  const app = useServices('tasks', 'sheets')
  const { m, it } = useSubject(req.n)
  if (!m || !it) return null
  const hide = () => {
    app.sheets.close()
    void app.tasks.hideMessage(it.n, req.id)
  }
  return <SheetLayout {...messageMenuSheet(hide)} />
}

/** Later (D115 #21): until Tomorrow, Next week or a day picked, then back to Now by itself; or no day. */
export function LaterSheet({ req }: Req<'later'>) {
  const app = useServices('tasks', 'sheets')
  const { m, it, code } = useSubject(req.n)
  if (!m || !it) return null
  const now = m.at
  return (
    <SheetLayout
      {...laterSheet(code(it.n), { later: it.when === 'later', until: it.later_until ?? null, days: laterDays(now), say: (day) => laterDay(day, now) }, {
        pick: (day) => app.sheets.close(() => void app.tasks.later(it.n, day)),
        now: () => app.sheets.close(() => void app.tasks.change(it.n, 'when', 'now')),
      })}
    />
  )
}

/** What an agent reading the task gets: its card, read as an agent reads it (not counted as an agent's visit). */
export function AgentCardSheet({ req }: Req<'agent-card'>) {
  const app = useServices('api')
  const { slug, m, it, code } = useSubject(req.n)
  const c = it ? code(it.n) : ''
  const key = slug + ' ' + c
  const [got, setGot] = useState<{ key: string; text: string } | null>(null)
  useEffect(() => {
    if (!slug || !c) return
    let on = true
    app.api.card(slug, c).then(
      (text) => on && setGot({ key, text }),
      () => on && setGot({ key, text: 'Taska could not be reached. Try again.' }),
    )
    return () => {
      on = false
    }
  }, [app, slug, c, key])
  if (!m || !it) return null
  return <SheetLayout {...agentCardSheet(c, got?.key === key ? got.text : null)} />
}
