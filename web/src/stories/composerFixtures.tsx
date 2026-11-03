// The helpers Composer's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { boxAt, type Here } from './boxFixtures'

type Story = StoryObj

/** the phone has no box over a document unless it edits something there (B643): those boxes are the desktop's only */
const phoneHasIt = (h: Here) => !/^D\d/.test(h.at ?? '') || !!h.mode
export const at = (h: Here): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720} phone={phoneHasIt(h)}>{(layout) => boxAt(h, layout === 'desk')}</Frames> })
export const words = 'The export should keep the filter I set.'
