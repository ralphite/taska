// The helpers ComposerWriting's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { boxAt, type Here } from './boxFixtures'

type Story = StoryObj

export const at = (h: Here = {}, pseudo?: Record<string, string[]>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => boxAt(h, layout === 'desk')}</Frames>,
  ...(pseudo ? { parameters: { pseudo } } : {}),
})
export const LINES = 'First line\nSecond line\nThird line'
export const MANY = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: what I want the export to keep.`).join('\n')
