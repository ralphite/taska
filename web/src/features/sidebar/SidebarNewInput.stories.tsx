// The sidebar's New input button (T701), on the desktop only (the phone's drawer has none): its mic always at its end
// (New input by voice; F777 r1301: no key there, the key is in the tip), its centre in line with the projects' marks
// and the fold button above; lit while the New input page is open.
// The page's own sidebar, its top.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { side } from '../../stories/sideFixtures'

export default { title: 'UI/Left sidebar/New input button' } satisfies Meta
type Story = StoryObj

const LOOKS: [label: string, look: string, composing: boolean][] = [
  ['as it is', 'plain', false],
  ['under the pointer', 'pointer', false],
  ['pointer on its mic', 'pointer-mic', false],
  ['on the New input page: lit', 'composing', true],
  ['on the New input page, under the pointer', 'composing-pointer', true],
]

/** Each look side by side. */
export const NewInputButton: Story = {
  name: 'As it is, pointer, on the New input page',
  parameters: {
    pseudo: {
      hover: [
        '[data-look="pointer"] .group\\/ni',
        '[data-look="pointer"] .group\\/ni > button:first-child',
        '[data-look="pointer-mic"] .group\\/ni',
        '[data-look="pointer-mic"] button[aria-label="New input by voice"]',
        '[data-look="composing-pointer"] .group\\/ni',
        '[data-look="composing-pointer"] .group\\/ni > button:first-child',
      ],
    },
  },
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {LOOKS.map(([label, look, composing]) => (
        <Frame key={look} layout="desk" width={240} height={120} label={label}>
          <div data-look={look} className="h-full">
            {side(false, { composing })}
          </div>
        </Frame>
      ))}
    </div>
  ),
}
