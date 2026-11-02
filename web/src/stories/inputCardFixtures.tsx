// The helpers InputCard's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Input } from '../model/types'
import { Frames } from './Frames'
import { cardOf, type Said } from './inputFixtures'

type Story = StoryObj

export const one = (r: Input, s: Said = { organizer: true }): Story => ({ render: () => <Frames desk={false} phoneWidth={393}>{() => cardOf(r, s)}</Frames> })
