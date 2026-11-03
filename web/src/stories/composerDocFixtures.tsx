// The helpers ComposerDoc's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { boxAt, type Here } from './boxFixtures'

type Story = StoryObj

export const at = (h: Here, o: { phone?: boolean; desk?: boolean } = {}): Story => ({
  // the phone has no box over a document unless it edits something there (B643)
  render: () => <Frames phoneWidth={393} deskWidth={720} phone={o.phone ?? !!h.mode} desk={o.desk ?? true}>{(layout) => boxAt(h, layout === 'desk')}</Frames>,
})
export const one = { at: 'D1', sel: ['k1'] }
