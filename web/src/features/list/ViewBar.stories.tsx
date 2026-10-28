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
