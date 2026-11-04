// The helpers NeedsCard's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { Item } from '../model/types'
import { Frames } from './Frames'
import { T, item, message, modelOf } from './fixtures'
import { noItemEvents, talkEnv } from './itemFixtures'
import { NeedsCard } from '../features/item/NeedsCard'

type Story = StoryObj

export const proposal = message({ id: 5, kind: 'propose', text: 'Keep the filter in the export: the rows the list shows, and the filter in the file name.' })
export const report = message({ id: 6, text: 'Done: the export writes the rows the list shows. Tested with three filters.' })
export const askOf = (text: string, by = 'claude-code') => ({ id: 7, kind: 'ask' as const, text, by, files: [] })
export const you = message({ id: 9, by: 'you', kind: 'say', text: 'Only the filter, not the sort.' })

/** The card with what the page holds for it (stores.itemView): its question's choices picked, Change your decision and
 * its Cancel; deciding and sending show in the Actions panel. */
function LiveCard({ f, o, desk }: { f: Partial<Item>; o: { remodify?: boolean; picked?: number[] }; desk: boolean }) {
  const it = item({ n: 12, ...f })
  const [remodify, setRemodify] = useState(!!o.remodify)
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set(o.picked))
  const pick = (i: number, multi: boolean) => {
    const next = new Set(multi ? picked : [])
    if (multi && next.has(i)) next.delete(i)
    else next.add(i)
    setPicked(next)
  }
  const on = { ...noItemEvents, modify: () => setRemodify(true), cancelModify: () => setRemodify(false) }
  return <NeedsCard it={it} env={{ ...talkEnv(modelOf([it]), desk), choosing: { picked, pick } }} on={on} remodify={remodify} />
}
export const at = (f: Partial<Item>, o: { remodify?: boolean; picked?: number[] } = {}): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => (
        <div className="p-3">
          <LiveCard f={f} o={o} desk={layout === 'desk'} />
        </div>
      )}
    </Frames>
  ),
})
export const q = (text: string) => ({ thread: [message({ id: 7, kind: 'ask', text })], wait: askOf(text) })
export const approved = { status: 'open' as const, thread: [proposal], decided: { from: 'proposed' as const, to: 'open' as const, msg: 5, t: T } }
export const repliedOnProposal = { status: 'proposed' as const, talked: true, thread: [proposal, you] }
