// A task open in its pane, as the page draws it: the pane's bar (the task's code and status, its actions, Previous
// and Next) and the page's own TaskPage, with a demo project around it and the state the page keeps for it. Used by
// the task page's stories.
import { useState, type CSSProperties, type ReactNode } from 'react'
import { DocPaneActs, DocPaneHead, DocPaneNav } from '../features/docs/DocPane'
import type { TaskEvents, TaskFacts } from '../features/task/TaskPage'
import { TaskActs, TaskHead, TaskNav, TaskPage, TaskTalk } from '../features/task/TaskPage'
import { taskMenuPop, taskMenuSheet, type TaskMenuEvents, type TaskMenuFacts } from '../features/task/TaskMenu'
import { taskMenuFacts } from '../features/task/taskMenuFacts'
import { messageMenuSheet, timesSheet } from '../features/task/TaskSheets'
import { taskTimes } from '../model/taskTimes'
import { gripVars } from '../stores/grips'
import type { TalkFacts } from '../features/task/Talk'
import type { TalkEnv } from '../features/task/talkEnv'
import type { Doc, Input, Task, VoiceStep } from '../model/types'
import { latestMessage } from '../model/talk'
import { PaneFrame } from '../ui/PaneFrame'
import { task, message } from './fixtures'
import { taskFacts, noTaskEvents, talkEnv, talkFacts } from './taskFixtures'
import { modelOf } from './fixtures'
import { act, acts } from './acts'
import { useMedia, usePop } from './liveParts'
import { inputMenuParts, type InputMenuAt } from './inputFixtures'
import { createPortal } from 'react-dom'
import { Tooltip } from '../app/Tooltip'
import { refCard } from '../model/refCard'
import { pickSheet } from '../ui/Pickers'

/** The task's parent and a long talk, for the stories that need them. */
export const PARENT = task({ n: 3, title: 'Exports that keep what you see' })
export const KIDS = [
  task({ n: 14, parent: 12, title: 'Keep the filter in the file name' }),
  task({ n: 15, parent: 12, status: 'done', title: 'Write the rows the list shows' }),
  task({ n: 16, parent: 12, when: 'later', title: 'Excel as well' }),
]
export const you = (id: number, text: string) => message({ id, by: 'you', kind: 'say', text })

export interface PageOpts {
  /** the rest of the project (its parent, its subtasks) */
  others?: Task[]
  docs?: Doc[]
  inputs?: Input[]
  f?: Partial<TaskFacts>
  t?: Partial<TalkFacts>
  /** the desktop's two columns: the task on the left, its talk on the right */
  duo?: boolean
  /** shown full width (O) */
  full?: boolean
  /** what the talk draws with: messages opened, a voice note playing */
  env?: Partial<TalkEnv>
  /** the pane's back (a prototype's way back) */
  onBack?(): void
  /** the task's title has scrolled out of sight: the bar says it (the phone) */
  titled?: boolean
  /** the desktop's two columns with a document on the left instead of the task (`bare`: a web page, no margins) */
  left?: ReactNode
  bare?: boolean
  /** the document on the left: the pane is the document's, its bar the document's (the way back to its task, Copy,
   * Edit, Move, Delete), as the page draws it */
  doc?: Doc
  /** the steps that worked out its voice notes' words, for the tooltip (T697) */
  steps?: VoiceStep[]
  /** its times in full, open (the phone's sheet, T704) */
  timesOpen?: boolean
  /** the line between the two columns being dragged, the left one this wide ("40%") */
  duoDragged?: string
  /** the talk scrolled up this far (px) from its end */
  scrolledUp?: number
  /** a prototype's additions (D152): to its page's events, to its menu's facts and events; `waitFor`: a task picked
   * in the menu's Wait for… */
  on?: Partial<TaskEvents>
  menu?: Partial<TaskMenuFacts>
  menuOn?: Partial<TaskMenuEvents>
  waitFor?(n: number): void
  /** what Wait for… does not offer besides the task itself (a group: never done) */
  waitSkip?: number[]
}

export const pageOf = (it: Task, desk: boolean, o: PageOpts = {}) => <LiveTask it={it} desk={desk} o={o} />

/** Only the task's talk, as its pane draws it: its messages and documents' comments in time, the card that waits on
 * you where its message is. */
export const talkOf = (it: Task, desk: boolean, o: PageOpts = {}) => <LiveTask it={it} desk={desk} o={o} talkOnly />

const toggle = (set: ReadonlySet<number>, n: number) => {
  const next = new Set(set)
  if (!next.delete(n)) next.add(n)
  return next
}
const taskMenuActs = acts('Task menu', ['edit', 'copy', 'agent', 'newDoc', 'addSub', 'reparent', 'later', 'archive', 'doNext', 'moveProject', 'remove', 'set', 'tag', 'group'] as const, {
  agent: 'Sheets › A task: what agents see',
  reparent: 'Move and pick › Put under',
  moveProject: 'Move and pick › Task to another project',
})
const hideMessage = act('Message menu: hide')

/** The task with what the page holds for it (stores.taskView, the grips, the player and viewer, the sheet open from
 * it): Change your decision and its Cancel, answering a question again, its choices picked, Show more and Show
 * earlier, a hidden message peeked at, adding a subtask and editing (their Cancel), Full width, the lines between its
 * parts dragged, voice notes playing, pictures opened, the task's menu and its Status, Priority and Type, a message's
 * menu (T662), its times in full (T704). What needs Taska or the rest of the page (deciding, sending, opening another task) shows in the
 * Actions panel. */
function LiveTask({ it, desk, o, talkOnly = false }: { it: Task; desk: boolean; o: PageOpts; talkOnly?: boolean }) {
  const m = modelOf([...(o.others ?? []), it], o.inputs ?? [], {}, o.docs ?? [])
  const start = taskFacts(m, it, o.f)
  const t0 = talkFacts(m, o.t)
  const e0 = talkEnv(m, desk, { latest: latestMessage(it), ...o.env })
  const [remodify, setRemodify] = useState(start.remodify)
  const [reask, setReask] = useState(t0.reask)
  const [picked, setPicked] = useState<ReadonlySet<number>>(e0.choosing?.picked ?? new Set())
  const [opened, setOpened] = useState<ReadonlySet<number>>(e0.opened)
  const [peeking, setPeeking] = useState<ReadonlySet<number>>(t0.peeking)
  const [editing, setEditing] = useState(start.editing)
  const [addingSub, setAddingSub] = useState(start.addingSub)
  const [full, setFull] = useState(!!o.full)
  const [sizes, setSizes] = useState({ top: 0, duo: 0 })
  // its talk, for the pane's button to its end (T716), as the page has it
  const [talk, setTalk] = useState<HTMLElement | null>(null)
  const media = useMedia(e0.url)
  const menu = usePop<{ arm: TaskMenuFacts['arm']; asking: boolean } | { msg: number } | { times: true } | { wait: true }>(desk, o.timesOpen ? { times: true } : undefined)
  const inputMenu = usePop<InputMenuAt>(desk)
  // the page's one tooltip (a voice note's words, icon buttons' names), over the whole window as the page has it; the
  // phone has none
  const tip = desk && createPortal(<Tooltip card={(ref) => refCard(m, ref)} steps={() => Promise.resolve(o.steps ?? [])} />, document.body)
  const facts = { ...start, remodify, editing, addingSub }
  const env = { ...e0, play: o.env?.play && !media.touched ? o.env.play : media.play, opened, choosing: e0.choosing && { picked, pick: (i: number, multi: boolean) => setPicked(multi ? toggle(picked, i) : new Set([i])) } }
  const tf = { ...t0, reask, peeking }
  const openMenu = (arm: TaskMenuFacts['arm'], from: Element | null) => menu.open({ arm, asking: false }, from, desk ? { narrow: !!arm } : {})
  const on: TaskEvents = {
    ...noTaskEvents,
    modify: () => setRemodify(true),
    cancelModify: () => setRemodify(false),
    decide: (k, status) => (setRemodify(false), noTaskEvents.decide(k, status)),
    notYet: (k) => (setRemodify(false), noTaskEvents.notYet(k)),
    reask: (k, id) => (setReask(id), noTaskEvents.reask(k, id)),
    cancelReask: () => setReask(null),
    more: (id) => setOpened(toggle(opened, id)),
    peek: (id) => setPeeking(toggle(peeking, id)),
    subNew: () => setAddingSub(true),
    subCancel: () => setAddingSub(false),
    subAdd: (title) => (noTaskEvents.subAdd(title), setAddingSub(false)),
    editSave: (fields) => (noTaskEvents.editSave(fields), setEditing(false)),
    editCancel: () => setEditing(false),
    topSize: (px) => setSizes({ ...sizes, top: px }),
    duoSize: (px) => setSizes({ ...sizes, duo: px }),
    play: media.on.play,
    words: media.on.words,
    picture: (f, all) => media.on.view(f, all),
    view: (f, all) => media.on.view(f, all),
    menu: (arm, from) => openMenu(arm, from),
    msgMenu: (id, from) => menu.open({ msg: id }, from),
    // the line under its chips: both times in full, the phone's sheet (T704)
    times: () => menu.open({ times: true }),
    // your message's ⋯: the menu of the input its words came from, as the page opens it
    inputMore: (id, from) => inputMenu.open({ id, asked: {} }, from),
    ...o.on,
  }
  // the task's menu as the page's TaskMenuSheet runs it: a row does its thing and the menu closes; Status..., Priority...,
  // Tags... show that field's choices in its place; Delete asks again
  const done = (run: () => void) => () => (menu.close(), run())
  const menuParts = (w: NonNullable<typeof menu.what>) => {
    if ('msg' in w) return messageMenuSheet(done(() => hideMessage(w.msg)))
    if ('times' in w) return timesSheet(taskTimes(it, env.now))
    if ('wait' in w) return pickSheet({ head: 'Wait for…', tasks: m.tasks, skip: [it.n, ...(o.waitSkip ?? [])], code: facts.code, desk }, (n) => (menu.close(), o.waitFor?.(n)))
    const mOn: TaskMenuEvents = {
      ...taskMenuActs,
      edit: done(() => setEditing(true)),
      addSub: done(() => setAddingSub(true)),
      copy: done(taskMenuActs.copy),
      newDoc: done(taskMenuActs.newDoc),
      later: done(taskMenuActs.later),
      archive: (v) => (menu.close(), taskMenuActs.archive(v)),
      doNext: done(taskMenuActs.doNext),
      remove: () => (w.asking ? (menu.close(), taskMenuActs.remove()) : menu.change({ ...w, asking: true })),
      set: (f, v) => (w.arm ? menu.close() : undefined, taskMenuActs.set(f, v)),
      field: (a) => menu.change({ arm: a, asking: false }, { narrow: true }),
      ...o.menuOn,
      tag: o.menuOn?.tag ?? taskMenuActs.tag,
      group: (v) => (menu.close(), (o.menuOn?.group ?? taskMenuActs.group)(v)),
      waitFor: () => menu.change({ wait: true }, { narrow: false }),
    }
    const mf = { ...taskMenuFacts(m, it, w.asking, w.arm), ...o.menu }
    return desk ? taskMenuPop(mf, mOn) : taskMenuSheet(mf, mOn)
  }
  const sized = { ...gripVars({ side: 0, list: 0, top: sizes.top, duo: sizes.duo }), ...(o.duoDragged ? { '--duo-w': o.duoDragged } : {}) } as CSSProperties
  if (talkOnly)
    return (
      <div className="flex flex-col gap-6 p-4">
        <TaskTalk it={it} f={facts} env={env} facts={tf} on={on} />
        {media.node}
        {menu.draw(menuParts)}
        {inputMenu.draw((w) => inputMenuParts(m, desk, w, inputMenu))}
        {tip}
      </div>
    )
  const page = <TaskPage it={it} f={facts} env={env} facts={tf} on={on} talkRef={setTalk} duo={o.duo} left={o.left} bare={o.bare} dragging={o.duoDragged ? 'duo' : null} scrolledUp={o.scrolledUp ?? null} />
  if (o.doc)
    return (
      <div className="flex h-full flex-col" style={sized}>
        <PaneFrame
          place=""
          desk={desk}
          split
          duo
          toEnd={talk}
          head={<DocPaneHead d={o.doc} editing={false} />}
          acts={<DocPaneActs web={o.doc.fmt === 'html'} inspect={false} whole={false} deleting={false} on={docPaneActs} />}
          lead={<DocPaneNav to={facts.code(it.n)} onBack={docBack} />}
          onBack={docBack}
        >
          {page}
        </PaneFrame>
        {media.node}
        {menu.draw(menuParts)}
        {inputMenu.draw((w) => inputMenuParts(m, desk, w, inputMenu))}
        {tip}
      </div>
    )
  return (
    <div className="flex h-full flex-col" style={sized}>
      <PaneFrame
        place=""
        desk={desk}
        split
        menu
        duo={o.duo}
        toEnd={talk}
        head={<TaskHead it={it} code={facts.code(it.n)} titled={o.titled} />}
        acts={<TaskActs it={it} on={on} />}
        nav={<TaskNav full={full} on={{ prev: paneActs.prev, next: paneActs.next, full: () => setFull(!full) }} />}
        onBack={o.onBack ?? paneActs.back}
        onMenu={(from) => openMenu(null, from)}
      >
        {page}
      </PaneFrame>
      {media.node}
      {menu.draw(menuParts)}
      {inputMenu.draw((w) => inputMenuParts(m, desk, w, inputMenu))}
      {tip}
    </div>
  )
}
const paneActs = acts('Pane', ['prev', 'next', 'back'] as const)
const docPaneActs = acts('Document pane', ['inspect', 'whole', 'full', 'copy', 'edit', 'move', 'remove'] as const)
const docBack = act('Document pane: back to its task')
