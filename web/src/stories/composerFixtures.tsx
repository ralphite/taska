// The helpers Composer's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { boxAt, type Here } from './boxFixtures'

type Story = StoryObj

export const at = (h: Here): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => boxAt(h, layout === 'desk')}</Frames> })
export const words = 'The export should keep the filter I set.'
