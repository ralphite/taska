import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemPage, NeedsCard } from './Detail'
import { ask, item, load } from '../test/fixture'
import { byN } from '../lib/state'
import type { Msg, Wait } from '../lib/types'

const t = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const thread: Msg[] = [
  { id: 1, by: 'you', text: 'Exports should follow the filter I set.', t: t(90), src: null } as unknown as Msg,
  {
    id: 2,
    by: 'claude-code',
    kind: 'progress',
    text: 'Found it: the export reads the list before the filter applies.',
    t: t(60),
  } as unknown as Msg,
  {
    id: 3,
    by: 'claude-code',
    kind: 'ask',
    text: 'Which format should the export use?\n- ( ) CSV\n- ( ) JSON',
    t: t(30),
  } as unknown as Msg,
]
const setup = (n: number) => () => {
  load([
    item(1, {
      type: 'bug',
      title: 'Export ignores the filter',
      body: 'When a filter is set, **Export** still writes every row.',
      pri: 'P0',
      status: 'doing',
      thread,
      wait: { ...ask(1, thread[2].text), id: 3 } as unknown as Wait,
    }),
    item(2, {
      title: 'Write the user docs',
      status: 'review',
      thread: [
        {
          id: 4,
          by: 'codex',
          kind: 'progress',
          text: 'Done: the install page and the FAQ are in docs/.',
          t: t(5),
        } as unknown as Msg,
      ],
    }),
  ])
  return { n }
}
const meta: Meta = { title: 'Page/Item' }
export default meta

/** The item page: title, its properties, the conversation, what it needs from you at the end. */
export const Page: StoryObj = {
  loaders: [setup(1)],
  render: () => (
    <div className="h-[860px] max-w-[46rem] overflow-y-auto">
      <ItemPage it={byN.get(1)!} />
    </div>
  ),
}
/** The card an agent's question becomes: tap a choice, then Send answer. */
export const Question: StoryObj = {
  loaders: [setup(1)],
  render: () => (
    <div className="max-w-[40rem] p-4">
      <NeedsCard it={byN.get(1)!} />
    </div>
  ),
}
/** Finished work waits for you to accept it. */
export const Review: StoryObj = {
  loaders: [setup(2)],
  render: () => (
    <div className="max-w-[40rem] p-4">
      <NeedsCard it={byN.get(2)!} />
    </div>
  ),
}

// T457: the states design goes wrong in most
const more = (n: number, f: Parameters<typeof item>[1]) => () => {
  load([
    item(n, f),
    item(n + 1, { title: 'A subitem', parent: n }),
    item(n + 2, { title: 'Another subitem', parent: n, status: 'done' }),
  ])
  return {}
}
const full = (n: number) => () => (
  <div className="h-[860px] max-w-[46rem] overflow-y-auto">
    <ItemPage it={byN.get(n)!} />
  </div>
)
/** An agent proposed it: Approve or Won't do. */
export const Proposed: StoryObj = {
  loaders: [
    more(10, {
      type: 'idea',
      title: 'Dark mode for the reports',
      status: 'proposed',
      by: 'claude-code',
      thread: [
        {
          id: 11,
          by: 'claude-code',
          kind: 'propose',
          text: 'Reports are hard to read at night; a dark theme would follow the system setting.',
          t: t(20),
        } as unknown as Msg,
      ],
    }),
  ],
  render: full(10),
}
/** An agent is stuck and needs you. */
export const Blocked: StoryObj = {
  loaders: [
    more(20, {
      type: 'bug',
      title: 'Push notifications stopped on the phone',
      pri: 'P1',
      status: 'doing',
      thread: [
        {
          id: 21,
          by: 'codex',
          ses: 'worker',
          kind: 'block',
          text: 'The tunnel is down, so the phone cannot reach Taska. Run `devtunnel host` and tell me when it is up.',
          t: t(10),
        } as unknown as Msg,
      ],
      wait: {
        id: 21,
        kind: 'block',
        by: 'codex',
        ses: 'worker',
        text: 'The tunnel is down, so the phone cannot reach Taska.',
        files: [],
      },
    }),
  ],
  render: full(20),
}
/** A question with several ticks ("- [ ]"). */
export const Checklist: StoryObj = {
  loaders: [
    more(30, {
      title: 'Pick the fixes for the box',
      status: 'doing',
      wait: {
        id: 31,
        kind: 'ask',
        by: 'claude-code',
        text: 'Which of these should I fix?\n- [ ] The box jumps when a line is added\n- [ ] The send button hides behind the keyboard\n- [ ] The draft is lost after a reload\n- [ ] Long words overflow the bubble',
        files: [],
      } as unknown as Wait,
      thread: [
        {
          id: 31,
          by: 'claude-code',
          kind: 'ask',
          text: 'Which of these should I fix?\n- [ ] The box jumps when a line is added\n- [ ] The send button hides behind the keyboard\n- [ ] The draft is lost after a reload\n- [ ] Long words overflow the bubble',
          t: t(3),
        } as unknown as Msg,
      ],
    }),
  ],
  render: full(30),
}
/** You approved it: the decided card stays until the agent writes again. */
export const Decided: StoryObj = {
  loaders: [
    more(40, {
      title: 'Show who wrote each message',
      status: 'open',
      decided: { from: 'proposed', to: 'open', msg: 41, t: t(1) },
      thread: [
        {
          id: 41,
          by: 'claude-code',
          kind: 'propose',
          text: 'Record the session with every message and show it after the agent’s name.',
          t: t(30),
        } as unknown as Msg,
      ],
    }),
  ],
  render: full(40),
}
/** A long conversation, long words, a long title, files and a done item. */
export const LongThread: StoryObj = {
  loaders: [
    more(50, {
      type: 'feature',
      title:
        'A very long title that keeps going to see how the header wraps on a narrow phone screen and on the desktop',
      status: 'done',
      body: 'A body with a link https://example.com/a/very/long/path/that/does/not/break/easily/at/all and `code`.',
      thread: Array.from({ length: 14 }, (_, i) =>
        i % 3 === 0
          ? ({
              id: 51 + i,
              by: 'you',
              kind: 'say',
              text:
                i === 6
                  ? 'Supercalifragilisticexpialidocious-words-without-spaces-should-wrap-somewhere'
                  : `Reply number ${i}`,
              t: t(200 - i * 10),
              src: null,
            } as unknown as Msg)
          : ({
              id: 51 + i,
              by: i % 2 ? 'claude-code' : 'codex',
              ses: i % 2 ? 'worker' : undefined,
              kind: i === 13 ? 'progress' : 'say',
              text:
                i === 13
                  ? 'Done.\n\n**Result**: it works.\n- one\n- two\n- three'
                  : 'Progress so far: the change is in, the tests pass, and the page looks right on the phone.',
              t: t(200 - i * 10),
            } as unknown as Msg),
      ),
    }),
  ],
  render: full(50),
}
