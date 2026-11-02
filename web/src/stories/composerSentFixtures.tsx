// The helpers ComposerSent's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Input } from '../model/types'
import { Frames } from './Frames'
import { input } from './fixtures'
import { sentLine } from './boxFixtures'

type Story = StoryObj

export const at = (f: Parameters<typeof sentLine>[0]): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => sentLine(f, layout === 'desk')}</Frames> })
export const sent = (f: Partial<Input> = {}) => input({ id: 'r12', text: 'Buy milk on the way home', ...f })
export const org = (ok: boolean, msg: string) => ({ ok, msg, t: '', keep: false, changed: ok, undone: false })
