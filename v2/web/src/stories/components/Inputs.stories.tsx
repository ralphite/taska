// T457: what you said (inputs): the Inputs tab, one input in each state it can be in, and the New input page's list.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ComposeHead, InputCard, InputPane, InputPaneHead, OutboxRows, SaidLately } from '../../components/Inputs'
import { DraftCard } from '../../components/Composer'
import { U, model } from '../../lib/state'
import type { Input } from '../../lib/types'
import { Pane, type Setup } from '../lib/demo'
import { Column, ListColumn } from '../lib/column'

const meta: Meta = {
  title: 'Components/Inputs',
  parameters: {
    covers: [
      'InputsView',
      'InputRow',
      'InputCard',
      'NotHandled',
      'InputPane',
      'InputPaneHead',
      'OutboxRows',
      'OutboxStep',
      'SaidLately',
      'SaidStep',
      'SaidRow',
      'TakeBack',
      'ComposeHead',
      'DraftCard',
    ],
  },
}
export default meta
type Story = StoryObj

/** The Inputs tab: the list (and on the desktop the one picked, whole). */
const tab = (setup?: (x: Setup) => void): Story => ({
  parameters: { taska: { setup: (x) => ((U.tab = 'inputs'), setup?.(x)) } },
  render: () => (
    <div className="flex h-screen">
      <ListColumn inputs />
      <div className="hidden min-w-0 flex-1 flex-col lg:flex">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <InputPaneHead />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <InputPane />
        </div>
      </div>
    </div>
  ),
})
export const InputsTab = tab()
export const InputsTabSearch = tab(() => (U.q = '\u5bfc\u51fa'))
export const InputsTabWithOneOnItsWay = tab(() => {
  U.outbox = [
    {
      id: 'q1',
      q: 'q1',
      t: Date.now(),
      text: '\u987a\u4fbf\u628a\u5bfc\u51fa\u6309\u94ae\u6539\u6210\u84dd\u8272',
      files: [],
      scope: null,
      p: '/p/shop/',
      sending: true,
    },
  ]
})
export const InputsTabEmpty: Story = {
  ...tab(),
  parameters: { taska: { project: 'website', setup: () => (U.tab = 'inputs') } },
}

/** One input, whole, in the state `change` puts it in. */
const card = (pick: (S: Input[]) => Input, change?: (r: Input) => void): Story => ({
  parameters: {
    taska: {
      setup: ({ S }) => {
        const r = pick(S.inputs)
        change?.(r)
        U.inSel = r.id
      },
    },
  },
  render: () => {
    const r = model.S.inputs.find((x) => x.id === U.inSel)!
    return (
      <Pane w="item">
        <div className="mx-auto w-full max-w-[46rem] px-4 pt-6 pb-12 lg:px-8">
          <InputCard r={r} pane />
        </div>
      </Pane>
    )
  },
})
const waiting = (S: Input[]) => S.find((r) => !r.acked && r.files.some((f) => f.mime?.startsWith('image/')))!
const voice = (S: Input[]) => S.find((r) => !r.acked && r.files.some((f) => f.mime?.startsWith('audio/')))!
const made = (S: Input[]) => S.find((r) => r.org?.msg.startsWith('Created') && r.files.length > 1)!
const added = (S: Input[]) => S.find((r) => r.org?.msg.startsWith('Added'))!

export const WaitingForYourAgent = card(waiting)
export const VoiceNote = card(voice)
export const Transcribing = card(voice, (r) => (r.tr_wait = true))
/** Made into an item: what became of it under your words. */
export const MadeAnItem = card(made)
export const AddedToAnItem = card(added)
export const Organizing = card(waiting, (r) => {
  model.S.org = { on: true, model: 'gemini', busy: r.id }
})
export const LeftForYourAgent = card(waiting, (r) => {
  r.org = { ok: true, msg: 'Left for your coding agent', t: r.t, keep: true }
})
export const HandledByYourAgent = card(waiting, (r) => {
  r.acked = true
  r.org = { ok: true, msg: 'Left for your coding agent', t: r.t, keep: true }
})
export const SeenByYourAgent = card(waiting, (r) => (r.acked = true))
export const OrganizerFailed = card(waiting, (r) => {
  r.org = { ok: false, msg: 'Some commands failed: B99 not found', t: r.t, keep: false }
})
export const Undone = card(made, (r) => {
  if (r.org) r.org.undone = true
})
export const Edited = card(added, (r) => {
  r.history = [{ text: r.text.slice(0, 12), t: r.t, mode: 'edit' }]
  r.updated = new Date().toISOString()
  r.v = 1
})
export const MovedToAnotherProject = card(waiting, (r) => {
  r.moved = { to: 'mobile-app', as: 'r4' }
})
export const AnAnswer = card(added, (r) => (r.kind = 'answer'))

/** What is still on its way, first where your inputs are listed. */
export const OnItsWay: Story = {
  parameters: {
    taska: {
      setup: () => {
        const base = { files: [], scope: null, p: '/p/shop/' }
        U.outbox = [
          {
            ...base,
            id: 'q1',
            q: 'q1',
            t: Date.now() - 5000,
            text: '\u53d1\u9001\u4e2d\u7684\u4e00\u6761',
            sending: true,
          },
          {
            ...base,
            id: 'q2',
            q: 'q2',
            t: Date.now() - 60000,
            text: '\u6ca1\u53d1\u51fa\u53bb\u7684\u4e00\u6761',
            failed: true,
          },
          {
            ...base,
            id: 'q3',
            q: 'q3',
            t: Date.now() - 120000,
            text: '\u7b49 Taska \u56de\u6765\u518d\u53d1\u7684\u4e00\u6761',
            failed: true,
            net: true,
          },
        ]
      },
    },
  },
  render: () => (
    <Pane w="list">
      <OutboxRows />
    </Pane>
  ),
}

/** The New input page (desktop: nothing open); on the phone, the list with the box at its foot. */
export const NewInputPage: Story = {
  render: () => <Column />,
}
export const SaidLatelyList: Story = {
  render: () => (
    <Pane w="item">
      <div className="mx-auto max-w-[42rem] p-4">
        <SaidLately draft={<DraftCard />} />
      </div>
    </Pane>
  ),
}
export const ProjectHead: Story = {
  render: () => (
    <div className="p-6">
      <ComposeHead />
    </div>
  ),
}
