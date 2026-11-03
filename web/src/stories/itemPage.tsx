// An item open in its pane, as the page draws it: the pane's bar (the item's code and status, its actions, Previous
// and Next) and the page's own ItemPage, with a demo project around it. Used by the item page's stories.
import type { ReactNode } from 'react'
import { DocPaneActs, DocPaneHead, DocPaneNav } from '../features/docs/DocPane'
import type { ItemFacts } from '../features/item/ItemPage'
import { ItemActs, ItemHead, ItemNav, ItemPage, ItemTalk } from '../features/item/ItemPage'
import type { TalkFacts } from '../features/item/Talk'
import type { TalkEnv } from '../features/item/talkEnv'
import type { Doc, Input, Item } from '../model/types'
import { latestMessage } from '../model/talk'
import { PaneFrame } from '../ui/PaneFrame'
import { item, message } from './fixtures'
import { itemFacts, noItemEvents, talkEnv, talkFacts } from './itemFixtures'
import { modelOf } from './fixtures'

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
  /** the desktop's way back, first in the pane's bar (a prototype's: back to a search) */
  lead?: ReactNode
  /** the desktop's two columns with a document on the left instead of the item (`bare`: a web page, no margins) */
  left?: ReactNode
  bare?: boolean
  /** the document on the left: the pane is the document's, its bar the document's (the way back to its item, Copy,
   * Edit, Move, Delete), as the page draws it */
  doc?: Doc
}

export function pageOf(it: Item, desk: boolean, o: PageOpts = {}) {
  const m = modelOf([...(o.others ?? []), it], o.inputs ?? [], {}, o.docs ?? [])
  const facts = itemFacts(m, it, o.f)
  const no = () => {}
  const page = <ItemPage it={it} f={facts} env={talkEnv(m, desk, { latest: latestMessage(it), ...o.env })} facts={talkFacts(m, o.t)} on={noItemEvents} duo={o.duo} left={o.left} bare={o.bare} />
  if (o.doc)
    return (
      <div className="flex h-full flex-col">
        <PaneFrame
          place=""
          desk={desk}
          split
          duo
          head={<DocPaneHead d={o.doc} editing={false} />}
          acts={<DocPaneActs web={o.doc.fmt === 'html'} inspect={false} deleting={false} on={{ inspect: no, copy: no, edit: no, move: no, remove: no }} />}
          lead={<DocPaneNav to={facts.code(it.n)} onBack={no} />}
          onBack={no}
        >
          {page}
        </PaneFrame>
      </div>
    )
  return (
    <div className="flex h-full flex-col">
      <PaneFrame
        place=""
        desk={desk}
        split
        menu
        duo={o.duo}
        head={<ItemHead it={it} code={facts.code(it.n)} />}
        acts={<ItemActs it={it} on={noItemEvents} />}
        nav={<ItemNav full={!!o.full} on={{ prev: () => {}, next: () => {}, full: () => {} }} />}
        lead={o.lead}
        onBack={o.onBack ?? (() => {})}
      >
        {page}
      </PaneFrame>
    </div>
  )
}

/** Only the item's talk, as its pane draws it: its messages and documents' comments in time, the card that waits on
 * you where its message is. */
export function talkOf(it: Item, desk: boolean, o: PageOpts = {}) {
  const m = modelOf([...(o.others ?? []), it], o.inputs ?? [], {}, o.docs ?? [])
  return (
    <div className="flex flex-col gap-6 p-4">
      <ItemTalk it={it} f={itemFacts(m, it, o.f)} env={talkEnv(m, desk, { latest: latestMessage(it), ...o.env })} facts={talkFacts(m, o.t)} on={noItemEvents} />
    </div>
  )
}
