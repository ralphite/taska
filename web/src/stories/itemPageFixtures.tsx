// The helpers ItemPage's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Item } from '../model/types'
import { Frames } from './Frames'
import { item, message } from './fixtures'
import { PARENT, pageOf, you, type PageOpts } from './itemPage'

type Story = StoryObj

export const body = 'The export writes **every** row; it should write the rows the list shows.\n\n- with the filter\n- with the sort'
export const base = (f: Partial<Item>): Item => item({ n: 12, parent: 3, pri: 'P1', body, next: 'Read the filter from the address', srcs: ['r4'], ...f })
export const at = (f: Partial<Item>, o: PageOpts = {}, height = 820): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={900} height={height}>{(layout) => pageOf(base(f), layout === 'desk', { others: [PARENT], ...o })}</Frames>,
})
export const said = you(1, 'The export should keep the filter I set.')
export const ask = (id: number, text: string, kind: 'ask' | 'block' = 'ask'): Partial<Item> => ({ wait: { id, kind, text, by: 'claude-code', files: [] }, thread: [said, message({ id, kind, text })] })
export const report = message({ id: 6, text: 'Done: the export writes the rows the list shows. Tested with three filters.' })
