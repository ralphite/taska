import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { act } from '../stories/acts'
import { useMedia } from '../stories/liveParts'
import { Frames, States } from '../stories/Frames'
import { item, modelOf } from '../stories/fixtures'
import { talkEnv } from '../stories/itemFixtures'
import { Rich } from './Markdown'

const meta: Meta = { title: 'Components/Conversation/Message parts/Words' }
export default meta
type Story = StoryObj

const m = modelOf([item({ n: 12 }), item({ n: 3, type: 'bug', code: 'B003' })])
const world = talkEnv(m, true).world
/** words as a message draws them: its choices pick (one, or any), a code opens what it names (the Actions panel), a
 * picture opens in the page's viewer */
function LiveRich({ text, extra }: { text: string; extra: Partial<Parameters<typeof Rich>[0]> }) {
  const [picked, setPicked] = useState<ReadonlySet<number>>(extra.choosing?.picked ?? new Set())
  const media = useMedia(world.url)
  const pick = (i: number, multi: boolean) => {
    const next = new Set(multi ? picked : [])
    if (multi && next.has(i)) next.delete(i)
    else next.add(i)
    setPicked(next)
  }
  return (
    <div className="p-3 text-[15px] text-zinc-800 dark:text-zinc-200">
      <Rich text={text} world={world} onRef={act('Words: open the code')} onPicture={(f, all) => media.on.view(f, all)} {...extra} choosing={extra.choosing ? { picked, pick } : null} />
      {media.node}
    </div>
  )
}
const rich = (text: string, extra: Partial<Parameters<typeof Rich>[0]> = {}) => <LiveRich text={text} extra={extra} />

const QUESTION = 'Which format should the export use?\n\n- ( ) CSV\n- ( ) Excel\n- ( ) **Both**, one file each'

/** Text as Taska shows it: words, lists, quotes, code, tables, codes that open what they name, choices. */
export const Blocks: Story = {
  name: 'Every kind of block',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {() => (
        <States
          items={[
            ['words: **bold**, *italic*, `code`, a link, a web address, codes', rich('The export *ignores* the **active filter**: see `export.ts`.\nLine two keeps its break. Docs: [the guide](https://example.com/guide), https://example.com/a/b.\nF012 and B003 are links; F099 names nothing.')],
            ['headings', rich('# Plan\n\n## Steps\n\n### A small one')],
            ['a quote', rich('> The export should keep the filter I set.\n> Every time.')],
            ['lists, nested by their indent', rich('- Read the filter\n  - from the address\n  - or the saved view\n- Write the rows\n\n1. First\n2. Second')],
            ['a table (cards on a phone)', rich('| Step | Who | When |\n|---|:-:|--:|\n| Read the filter | agent | now |\n| Write the rows | agent | later |')],
            ['a narrow table', rich('| Format | Size |\n|---|---|\n| CSV | small |')],
            ['code', rich('```\nconst rows = list.filter(shown)\nexport(rows)\n```')],
            ['a Mermaid diagram', rich('```mermaid\ngraph TD\n  A[You say it] --> B[Organizer files it]\n  B --> C{Agent picks it up}\n  C -->|done| D[Review]\n  C -->|question| E[Needs you]\n```')],
            ['a Mermaid block that is not a diagram', rich('```mermaid\ngraph TD\n  A --> \n```')],
            ['a picture', rich('The screen: ![the list](f3-shot.png)')],
          ]}
        />
      )}
    </Frames>
  ),
}

/** A question's choices: shown only, open to pick (one picked), answered (yours ticked). */
export const Choices: Story = {
  name: 'Choices to tick',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {() => (
        <States
          items={[
            ['shown only', rich(QUESTION)],
            ['open, nothing picked', rich(QUESTION, { choosing: { picked: new Set(), pick: () => {} } })],
            ['open, one picked', rich(QUESTION, { choosing: { picked: new Set([1]), pick: () => {} } })],
            ['pick any', rich('Which should it keep?\n\n- [ ] The filter\n- [ ] The sort\n- [ ] The columns', { choosing: { picked: new Set([0, 2]), pick: () => {} } })],
            ['answered', rich(QUESTION, { done: ['Excel'] })],
          ]}
        />
      )}
    </Frames>
  ),
}
// ---- more states (T639): pictures and diagrams on their way or failed, choices picked any way
const drawing = { ...world, diagram: () => new Promise<string>(() => {}) }
const gone = { ...world, url: () => '/no-such-file.png' }
const slow = { ...world, url: () => 'http://10.255.255.1/slow.png' }
/** a picture still loading, one that could not load, one from a web address, a diagram still being drawn */
export const OnTheirWay: Story = {
  name: 'Pictures and diagrams on their way or failed',
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {() => (
        <States
          items={[
            ['a picture still loading', rich('The screen: ![the list](f3-shot.png)', { world: slow })],
            ['a picture that could not load', rich('The screen: ![the list](f3-shot.png)', { world: gone })],
            ['a picture from a web address (opens the address)', rich(`The icon: ![icon](${location.origin}/icon-192.png)`)],
            ['a diagram still being drawn: its words meanwhile', rich('```mermaid\ngraph TD\n  A[You say it] --> B[Organizer files it]\n```', { world: drawing })],
          ]}
        />
      )}
    </Frames>
  ),
}
/** pick-any answered (square boxes, several ticked), and an open choice under the pointer */
export const ChoicesMore: Story = {
  name: 'Choices, more',
  parameters: { pseudo: { hover: ['[data-look="pointer"] [data-choice="1"]'] } },
  render: () => (
    <Frames phoneWidth={393} deskWidth={640}>
      {() => (
        <States
          items={[
            ['pick any, answered', rich('Which should it keep?\n\n- [ ] The filter\n- [ ] The sort\n- [ ] The columns', { done: ['The filter', 'The columns'] })],
            ['open, a choice under the pointer', <div data-look="pointer">{rich(QUESTION, { choosing: { picked: new Set(), pick: () => {} } })}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
