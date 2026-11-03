// The helpers the input line's stories share: one input as the phone's Inputs tab draws it and as the desktop's New
// input page draws it, side by side (the same line: on the desktop what became of it sits beside the words).
import type { StoryObj } from '@storybook/react-vite'
import type { Input } from '../model/types'
import { Frames } from './Frames'
import { cardOf, saidRowOf, type Said } from './inputFixtures'

type Story = StoryObj

export const one = (r: Input, s: Said = { organizer: true }): Story => ({ render: () => <Frames deskWidth={760}>{(layout) => (layout === 'desk' ? saidRowOf(r, s) : cardOf(r, s))}</Frames> })
