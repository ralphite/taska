// The helpers NeedsCard's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
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

export const at = (f: Partial<Item>, o: { remodify?: boolean; picked?: number[] } = {}): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const it = item({ n: 12, ...f })
        return (
          <div className="p-3">
            <NeedsCard it={it} env={{ ...talkEnv(modelOf([it]), layout === 'desk'), ...(o.picked ? { choosing: { picked: new Set(o.picked), pick: () => {} } } : {}) }} on={noItemEvents} remodify={!!o.remodify} />
          </div>
        )
      }}
    </Frames>
  ),
})
export const q = (text: string) => ({ thread: [message({ id: 7, kind: 'ask', text })], wait: askOf(text) })
export const approved = { status: 'open' as const, thread: [proposal], decided: { from: 'proposed' as const, to: 'open' as const, msg: 5, t: T } }
export const repliedOnProposal = { status: 'proposed' as const, talked: true, thread: [proposal, you] }
