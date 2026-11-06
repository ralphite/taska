// The helpers ComposerSent's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Input } from '../model/types'
import { Frames } from './Frames'
import { input } from './fixtures'
import { sentLine } from './boxFixtures'

type Story = StoryObj

// the line after sending is the phone's only (T689): the desktop shows each input in the New input page's list
export const at = (f: Parameters<typeof sentLine>[0]): Story => ({ render: () => <Frames desk={false} phoneWidth={393}>{() => sentLine(f, false)}</Frames> })
export const sent = (f: Partial<Input> = {}) => input({ id: 'r12', text: 'Make the export button bigger', ...f })
export const org = (ok: boolean, msg: string) => ({ ok, msg, t: '', keep: false, changed: ok, undone: false })
