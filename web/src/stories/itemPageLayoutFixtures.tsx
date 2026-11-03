// What the item page's layout, editing and bar stories share: an item with a parent, subitems and a short talk, drawn
// at both sizes or on a wide desktop; the pane's frame around a page.
import type { StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import type { Item } from '../model/types'
import { Frame, Frames } from './Frames'
import { item, message } from './fixtures'
import { KIDS, PARENT, pageOf, you, type PageOpts } from './itemPage'
import { Icon } from '../ui/Icon'
import { PaneFrame } from '../ui/PaneFrame'

type Story = StoryObj

export const it = (f: Partial<Item> = {}) =>
  item({ n: 12, parent: 3, pri: 'P1', body: 'The export writes **every** row; it should write the rows the list shows.', next: 'Read the filter from the address', thread: [you(1, 'The export should keep the filter I set.'), message({ id: 2, text: 'Reproduced it: the export reads the list before the filter.' })], ...f })
export const at = (o: PageOpts, height = 760, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={900} height={height}>{(layout) => pageOf(it(f), layout === 'desk', { others: [PARENT, ...KIDS], ...o })}</Frames>,
})
export const desk = (o: PageOpts, width: number): Story => ({
  render: () => (
    <Frame layout="desk" width={width} height={720} label="desktop">
      {pageOf(it(), true, { others: [PARENT, ...KIDS], ...o })}
    </Frame>
  ),
})

export const newInputHead = (
  <span className="flex items-center gap-2 text-sm font-semibold">
    <Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />
    New input
  </span>
)
/** The pane's frame as the page draws it, around a stand-in for the page. */
export const frame = (props: Partial<Parameters<typeof PaneFrame>[0]>, desk: boolean, children: ReactNode = <p className="px-8 py-4 text-[15px]">The page goes here.</p>) => (
  <div className="flex h-56 flex-col">
    <PaneFrame place="" desk={desk} onBack={() => {}} {...props}>
      {children}
    </PaneFrame>
  </div>
)
