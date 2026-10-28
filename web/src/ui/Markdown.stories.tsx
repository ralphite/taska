import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { item, modelOf } from '../stories/fixtures'
import { talkEnv } from '../stories/itemFixtures'
import { Rich } from './Markdown'

const meta: Meta = { title: 'Components/Conversation/Message parts' }
export default meta
type Story = StoryObj

const m = modelOf([item({ n: 12 }), item({ n: 3, type: 'bug', code: 'B003' })])
const world = talkEnv(m, true).world
const rich = (text: string, extra: Partial<Parameters<typeof Rich>[0]> = {}) => (
  <div className="p-3 text-[15px] text-zinc-800 dark:text-zinc-200">
    <Rich text={text} world={world} {...extra} />
  </div>
)

const QUESTION = 'Which format should the export use?\n\n- ( ) CSV\n- ( ) Excel\n- ( ) **Both**, one file each'

/** Text as Taska shows it: words, lists, quotes, code, tables, codes that open what they name, choices. */
export const Blocks: Story = {
  name: 'Markdown: every kind of block',
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
            ['a picture', rich('The screen: ![the list](f3-shot.png)')],
          ]}
        />
      )}
    </Frames>
  ),
}

/** A question's choices: shown only, open to pick (one picked), answered (yours ticked). */
export const Choices: Story = {
  name: 'Markdown: choices to tick',
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
