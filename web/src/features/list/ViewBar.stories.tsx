import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import type { ViewChip } from './rows'
import { ViewBar } from './ViewBar'

const meta: Meta = { title: 'Components/Item list/View chips' }
export default meta
type Story = StoryObj

const views = (on: string, needs = 2): ViewChip[] =>
  [
    ['wait', 'Needs you', needs],
    ['all', 'Active', 25],
    ['every', 'All', 197],
    ['archive', 'Archive', 281],
    ['queued', 'Queue', 9],
    ['later', 'Later', 14],
    ['closed', 'Finished', 160],
  ].map(([value, label, count]) => ({ value: value as string, label: label as string, count: count as number, on: value === on, dot: value === 'wait' && (count as number) > 0 }))

/** The row of views: the one shown is dark; more views past the edge have an arrow. */
export const Views: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['Active', <ViewBar views={views('all')} onView={() => {}} />],
            ['Needs you, nothing waiting', <ViewBar views={views('wait', 0)} onView={() => {}} />],
            ['Finished (scrolled to it)', <ViewBar views={views('closed')} onView={() => {}} />],
            ['with your own views', <ViewBar views={views('every')} own={[{ name: 'Bugs now', count: 6, on: false }, { name: 'P0', count: 1, on: false }]} onView={() => {}} />],
          ]}
        />
      )}
    </Frames>
  ),
}
// ---- more states (B636)
export const YourOwnViewShownBeingRenamed: Story = {
  name: 'Your own view: shown, being renamed',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['Your own view shown', <ViewBar views={views('')} own={[{ name: 'Bugs first', count: 6, on: true }]} onView={() => {}} />],
            ['Being renamed', <ViewBar views={views('')} own={[{ name: 'Bugs first', count: 6, on: true, editing: true }]} onView={() => {}} />],
          ]}
        />
      )}
    </Frames>
  ),
}
// ---- more states (T639)
/** a chip under the pointer, one from the keys (the browser's ring), and the edge arrow under the pointer */
export const PointerAndKeys: Story = {
  name: 'Pointer and keys',
  parameters: { pseudo: { hover: ['[data-look="pointer"] button:nth-of-type(3)', '[data-look="arrow"] button[aria-label]'], focusVisible: ['[data-look="keys"] button:nth-of-type(2)'] } },
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <States
          items={[
            ['a chip under the pointer', <div data-look="pointer"><ViewBar views={views('all')} onView={() => {}} /></div>],
            ['a chip from the keys', <div data-look="keys"><ViewBar views={views('all')} onView={() => {}} /></div>],
            ['the edge arrow under the pointer', <div data-look="arrow"><ViewBar views={views('all')} onView={() => {}} /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
