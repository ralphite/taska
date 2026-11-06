// An item open in its pane, as the page draws it: the pane's bar (the item's code and status, its actions, Previous
// and Next) and the page's own ItemPage, with a demo project around it and the state the page keeps for it. Used by
// the item page's stories.
import { useState, type CSSProperties, type ReactNode } from 'react'
import { DocPaneActs, DocPaneHead, DocPaneNav } from '../features/docs/DocPane'
import type { ItemEvents, ItemFacts } from '../features/item/ItemPage'
import { ItemActs, ItemHead, ItemNav, ItemPage, ItemTalk } from '../features/item/ItemPage'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents, type ItemMenuFacts } from '../features/item/ItemMenu'
import { itemMenuFacts } from '../features/item/itemMenuFacts'
import { messageMenuSheet } from '../features/item/ItemSheets'
import { gripVars } from '../stores/grips'
import type { TalkFacts } from '../features/item/Talk'
import type { TalkEnv } from '../features/item/talkEnv'
import type { Doc, Input, Item } from '../model/types'
import { latestMessage } from '../model/talk'
import { PaneFrame } from '../ui/PaneFrame'
import { item, message } from './fixtures'
import { itemFacts, noItemEvents, talkEnv, talkFacts } from './itemFixtures'
import { modelOf } from './fixtures'
import { act, acts } from './acts'
import { useMedia, usePop } from './liveParts'
import { inputMenuParts, type InputMenuAt } from './inputFixtures'
import { createPortal } from 'react-dom'
import { Tooltip } from '../app/Tooltip'
import { refCard } from '../model/refCard'

/** The item's parent and a long talk, for the stories that need them. */
export const PARENT = item({ n: 3, title: 'Exports that keep what you see' })
export const KIDS = [
  item({ n: 14, parent: 12, title: 'Keep the filter in the file name' }),
  item({ n: 15, parent: 12, status: 'done', title: 'Write the rows the list shows' }),
  item({ n: 16, parent: 12, when: 'later', title: 'Excel as well' }),
]
export const you = (id: number, text: string) => message({ id, by: 'you', kind: 'say', text })

export interface PageOpts {
  /** the rest of the project (its parent, its subitems) */
  others?: Item[]
  docs?: Doc[]
  inputs?: Input[]
  f?: Partial<ItemFacts>
  t?: Partial<TalkFacts>
  /** the desktop's two columns: the item on the left, its talk on the right */
  duo?: boolean
  /** shown full width (O) */
  full?: boolean
  /** what the talk draws with: messages opened, a voice note playing */
  env?: Partial<TalkEnv>
  /** the pane's back (a prototype's way back) */
  onBack?(): void
  /** the desktop's two columns with a document on the left instead of the item (`bare`: a web page, no margins) */
  left?: ReactNode
  bare?: boolean
  /** the document on the left: the pane is the document's, its bar the document's (the way back to its item, Copy,
   * Edit, Move, Delete), as the page draws it */
  doc?: Doc
}

export const pageOf = (it: Item, desk: boolean, o: PageOpts = {}) => <LiveItem it={it} desk={desk} o={o} />

/** Only the item's talk, as its pane draws it: its messages and documents' comments in time, the card that waits on
 * you where its message is. */
export const talkOf = (it: Item, desk: boolean, o: PageOpts = {}) => <LiveItem it={it} desk={desk} o={o} talkOnly />

const toggle = (set: ReadonlySet<number>, n: number) => {
  const next = new Set(set)
  if (!next.delete(n)) next.add(n)
  return next
}
const itemMenuActs = acts('Item menu', ['edit', 'copy', 'agent', 'newDoc', 'addSub', 'reparent', 'later', 'archive', 'doNext', 'moveProject', 'remove', 'set'] as const, {
  agent: 'Sheets › An item: what agents see',
  reparent: 'Move and pick › Put under',
  moveProject: 'Move and pick › Item to another project',
})
const hideMessage = act('Message menu: hide')

/** The item with what the page holds for it (stores.itemView, the grips, the player and viewer, the sheet open from
 * it): Change your decision and its Cancel, answering a question again, its choices picked, Show more and Show
 * earlier, a hidden message peeked at, adding a subitem and editing (their Cancel), Full width, the lines between its
 * parts dragged, voice notes playing, pictures opened, the item's menu and its Status, Priority and Type, a message's
 * menu (T662). What needs Taska or the rest of the page (deciding, sending, opening another item) shows in the
 * Actions panel. */
function LiveItem({ it, desk, o, talkOnly = false }: { it: Item; desk: boolean; o: PageOpts; talkOnly?: boolean }) {
  const m = modelOf([...(o.others ?? []), it], o.inputs ?? [], {}, o.docs ?? [])
  const start = itemFacts(m, it, o.f)
  const t0 = talkFacts(m, o.t)
  const e0 = talkEnv(m, desk, { latest: latestMessage(it), ...o.env })
  const [remodify, setRemodify] = useState(start.remodify)
  const [reask, setReask] = useState(t0.reask)
  const [picked, setPicked] = useState<ReadonlySet<number>>(e0.choosing?.picked ?? new Set())
  const [opened, setOpened] = useState<ReadonlySet<number>>(e0.opened)
  const [peeking, setPeeking] = useState<ReadonlySet<number>>(t0.peeking)
  const [allTalk, setAllTalk] = useState(start.allTalk)
  const [editing, setEditing] = useState(start.editing)
  const [addingSub, setAddingSub] = useState(start.addingSub)
  const [full, setFull] = useState(!!o.full)
  const [sizes, setSizes] = useState({ top: 0, duo: 0 })
  const media = useMedia(e0.url)
  const menu = usePop<{ arm: ItemMenuFacts['arm']; asking: boolean } | { msg: number }>(desk)
  const inputMenu = usePop<InputMenuAt>(desk)
  // the page's one tooltip (a voice note's words, icon buttons' names), over the whole window as the page has it; the
  // phone has none
  const tip = desk && createPortal(<Tooltip card={(ref) => refCard(m, ref)} />, document.body)
  const facts = { ...start, remodify, allTalk, editing, addingSub }
  const env = { ...e0, play: o.env?.play && !media.touched ? o.env.play : media.play, opened, choosing: e0.choosing && { picked, pick: (i: number, multi: boolean) => setPicked(multi ? toggle(picked, i) : new Set([i])) } }
  const tf = { ...t0, reask, peeking }
  const openMenu = (arm: ItemMenuFacts['arm'], from: Element | null) => menu.open({ arm, asking: false }, from, desk ? { narrow: !!arm } : {})
  const on: ItemEvents = {
    ...noItemEvents,
    modify: () => setRemodify(true),
    cancelModify: () => setRemodify(false),
    decide: (k, status) => (setRemodify(false), noItemEvents.decide(k, status)),
    notYet: (k) => (setRemodify(false), noItemEvents.notYet(k)),
    reask: (k, id) => (setReask(id), noItemEvents.reask(k, id)),
    cancelReask: () => setReask(null),
    more: (id) => setOpened(toggle(opened, id)),
    earlier: () => setAllTalk(true),
    peek: (id) => setPeeking(toggle(peeking, id)),
    subNew: () => setAddingSub(true),
    subCancel: () => setAddingSub(false),
    subAdd: (title) => (noItemEvents.subAdd(title), setAddingSub(false)),
    editSave: (fields) => (noItemEvents.editSave(fields), setEditing(false)),
    editCancel: () => setEditing(false),
    topSize: (px) => setSizes({ ...sizes, top: px }),
    duoSize: (px) => setSizes({ ...sizes, duo: px }),
    play: media.on.play,
    words: media.on.words,
    picture: (f, all) => media.on.view(f, all),
    view: (f, all) => media.on.view(f, all),
    menu: (arm, from) => openMenu(arm, from),
    msgMenu: (id, from) => menu.open({ msg: id }, from),
    // your message's ⋯: the menu of the input its words came from, as the page opens it
    inputMore: (id, from) => inputMenu.open({ id, asked: {} }, from),
  }
  // the item's menu as the page's ItemMenuSheet runs it: a row does its thing and the menu closes; Status..., Priority...,
  // Type... show that field's choices in its place; Delete asks again
  const done = (run: () => void) => () => (menu.close(), run())
  const menuParts = (w: NonNullable<typeof menu.what>) => {
    if ('msg' in w) return messageMenuSheet(done(() => hideMessage(w.msg)))
    const mOn: ItemMenuEvents = {
      ...itemMenuActs,
      edit: done(() => setEditing(true)),
      addSub: done(() => setAddingSub(true)),
      copy: done(itemMenuActs.copy),
      newDoc: done(itemMenuActs.newDoc),
      later: done(itemMenuActs.later),
      archive: (v) => (menu.close(), itemMenuActs.archive(v)),
      doNext: done(itemMenuActs.doNext),
      remove: () => (w.asking ? (menu.close(), itemMenuActs.remove()) : menu.change({ ...w, asking: true })),
      set: (f, v) => (w.arm ? menu.close() : undefined, itemMenuActs.set(f, v)),
      field: (a) => menu.change({ arm: a, asking: false }, { narrow: true }),
    }
    const mf = itemMenuFacts(m, it, w.asking, w.arm)
    return desk ? itemMenuPop(mf, mOn) : itemMenuSheet(mf, mOn)
  }
  const sized = gripVars({ side: 0, list: 0, top: sizes.top, duo: sizes.duo }) as CSSProperties
  if (talkOnly)
    return (
      <div className="flex flex-col gap-6 p-4">
        <ItemTalk it={it} f={facts} env={env} facts={tf} on={on} />
        {media.node}
        {menu.draw(menuParts)}
        {inputMenu.draw((w) => inputMenuParts(m, desk, w, inputMenu))}
        {tip}
      </div>
    )
  const page = <ItemPage it={it} f={facts} env={env} facts={tf} on={on} duo={o.duo} left={o.left} bare={o.bare} />
  if (o.doc)
    return (
      <div className="flex h-full flex-col" style={sized}>
        <PaneFrame
          place=""
          desk={desk}
          split
          duo
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
        head={<ItemHead it={it} code={facts.code(it.n)} />}
        acts={<ItemActs it={it} on={on} />}
        nav={<ItemNav full={full} on={{ prev: paneActs.prev, next: paneActs.next, full: () => setFull(!full) }} />}
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
const docPaneActs = acts('Document pane', ['inspect', 'whole', 'copy', 'edit', 'move', 'remove'] as const)
const docBack = act('Document pane: back to its item')
